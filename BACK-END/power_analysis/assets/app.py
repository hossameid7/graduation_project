from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from tsfresh import extract_features
from tsfresh.utilities.dataframe_functions import impute
from tsfresh.feature_extraction import MinimalFCParameters
from scipy.stats import skew, kurtosis
import pickle
from sklearn.preprocessing import StandardScaler, LabelEncoder
import traceback
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Load models safely with error handling
try:
    # Load FDD components
    with open('stacking_model.pkl', 'rb') as f:
        fdd_model = pickle.load(f)
    with open('fdd_scaler.pkl', 'rb') as f:
        fdd_scaler = pickle.load(f)
    with open('label_encoder.pkl', 'rb') as f:
        label_encoder = pickle.load(f)

    # Load RUL components
    with open('lightgbm_model.pkl', 'rb') as f:
        rul_model = pickle.load(f)
    with open('rul_scaler.pkl', 'rb') as f:
        rul_scaler = pickle.load(f)
    
    # Validate FDD label encoder
    expected_classes = ['1', '2', '3', '4']
    if not np.array_equal(label_encoder.classes_, expected_classes):
        logger.warning(f"LabelEncoder classes {label_encoder.classes_} do not match expected {expected_classes}")
    
    logger.info("Models loaded successfully")
except Exception as e:
    logger.error(f"Error loading models: {str(e)}")
    logger.error(traceback.format_exc())
    raise

feature_cols = ['H2', 'CO', 'C2H2', 'C2H4']
quantiles = [0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]
volatility_pairs = [('q0.99', 'q0.95'), ('q0.75', 'q0.5'), ('q0.5', 'q0.25'), ('q0.9', 'q0.75')]

# --- Preprocessing for FDD ---
def preprocess_fdd(data):
    try:
        df = pd.DataFrame(data,index=[0])
        missing_cols = [col for col in feature_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
        
        df['id'] = 'input'
        df['time'] = df.index
        ts_data = df[['id', 'time'] + feature_cols]
        
        extracted_features = extract_features(
            ts_data,
            column_id='id',
            column_sort='time',
            default_fc_parameters=MinimalFCParameters(),
            impute_function=impute
        )
        
        # Drop correlated features
        def drop_correlated_features(df, threshold=0.9):
            corr_matrix = df.corr().abs()
            upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
            to_drop = [column for column in upper.columns if any(upper[column] > threshold)]
            return df.drop(columns=to_drop)
        
        features = drop_correlated_features(extracted_features)
        
        # Ensure all expected features are present
        expected_features = fdd_scaler.feature_names_in_ if hasattr(fdd_scaler, 'feature_names_in_') else features.columns
        for f in expected_features:
            if f not in features.columns:
                features[f] = 0
        
        features = features[expected_features]
        return fdd_scaler.transform(features)
    except Exception as e:
        logger.error(f"Error in FDD preprocessing: {str(e)}")
        logger.error(traceback.format_exc())
        raise

# --- Preprocessing for RUL ---
def preprocess_rul(data):
    try:
        df = pd.DataFrame(data,index=[0])
        missing_cols = [col for col in feature_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")
        
        features = {}
        
        # Calculate quantiles
        try:
            quantile_vals = df[feature_cols].quantile(quantiles)
            
            for col in feature_cols:
                for q in quantiles:
                    features[f'{col}_q{q}'] = quantile_vals.loc[q, col]
                
                for q_high, q_low in volatility_pairs:
                    q_high_val = float(q_high[1:]) if 'q' in q_high else float(q_high)
                    q_low_val = float(q_low[1:]) if 'q' in q_low else float(q_low)
                    features[f'{col}_vol_{q_high[1:]}_{q_low[1:]}'] = quantile_vals.loc[q_high_val, col] - quantile_vals.loc[q_low_val, col]
        except Exception as e:
            logger.error(f"Error calculating quantiles: {str(e)}")
            raise
        
        # Calculate statistics
        try:
            stats = df[feature_cols].agg(['max', 'min', 'std'])
            stats.loc['range'] = stats.loc['max'] - stats.loc['min']
            stats.loc['mean'] = df[feature_cols].mean()
            stats.loc['cv'] = stats.loc['std'] / stats.loc['mean']
            
            for col in feature_cols:
                features[f'{col}_range'] = stats.loc['range', col]
                features[f'{col}_std'] = stats.loc['std', col]
                features[f'{col}_cv'] = stats.loc['cv', col]
        except Exception as e:
            logger.error(f"Error calculating statistics: {str(e)}")
            raise
        
        # Calculate skew and kurtosis
        try:
            for col in feature_cols:
                features[f'{col}_skew'] = skew(df[col].dropna())
                features[f'{col}_kurtosis'] = kurtosis(df[col].dropna())
        except Exception as e:
            logger.error(f"Error calculating skew/kurtosis: {str(e)}")
            raise
        
        features_df = pd.DataFrame([features])
        
        # Ensure all expected features are present
        expected_features = rul_scaler.feature_names_in_ if hasattr(rul_scaler, 'feature_names_in_') else features_df.columns
        for f in expected_features:
            if f not in features_df.columns:
                features_df[f] = 0
        
        features_df = features_df[expected_features]
        return rul_scaler.transform(features_df)
    except Exception as e:
        logger.error(f"Error in RUL preprocessing: {str(e)}")
        logger.error(traceback.format_exc())
        raise

@app.route('/predict', methods=['POST'])
def combined_predict():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No input data provided'}), 400

        logger.info(f"Received request with data shape: {pd.DataFrame(data,index=[0]).shape}")

        # Preprocess and predict FDD
        fdd_input = preprocess_fdd(data)
        fdd_pred = fdd_model.predict(fdd_input)[0]
        fdd_probs = fdd_model.predict_proba(fdd_input)[0]
        fdd_label = label_encoder.inverse_transform([fdd_pred])[0]

        # Preprocess and predict RUL
        rul_input = preprocess_rul(data)
        rul_pred = rul_model.predict(rul_input)[0]

        response = {
            'fdd': {
                'predicted_class': str(fdd_label),
                'probabilities': {str(label_encoder.classes_[i]): float(p) for i, p in enumerate(fdd_probs)}
            },
            'rul': {
                'predicted_rul': float(rul_pred)
            }
        }
        
        logger.info(f"Successfully processed request")
        return jsonify(response), 200

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error processing request: {error_msg}")
        logger.error(traceback.format_exc())
        return jsonify({'error': error_msg}), 400

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)