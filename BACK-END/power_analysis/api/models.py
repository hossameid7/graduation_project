import pandas as pd  
from django.contrib.auth.models import AbstractUser, User
from django.db import models
import numpy as np
from .ml_model import FDD_MODEL,RUL_MODEL , FDD_SCALER,RUL_SCALER , le # Import the globally loaded model
import logging
from django.utils import timezone

from tsfresh import extract_features
from tsfresh.utilities.dataframe_functions import impute
from tsfresh.feature_extraction import MinimalFCParameters

logger = logging.getLogger(__name__)

class CustomUser(AbstractUser):
    email = models.EmailField(unique=True, blank=False, null=False)
    phone = models.CharField(max_length=50, blank=True, null=True,unique=True)
    dateOfBirth = models.DateField(blank=True, null=True)
    company = models.CharField(max_length=255, blank=True, null=True)
    

    def __str__(self):
        return self.username

class Transformer(models.Model):
    user = models.ForeignKey('CustomUser', on_delete=models.CASCADE, related_name='transformers')
    name = models.CharField(max_length=255)
    
    def __str__(self):
        return f"{self.name}"

    def save(self, *args, **kwargs):
        self.name = self.name.lower().strip()
        super().save(*args, **kwargs)

    class Meta:
        # Make name unique per user
        unique_together = ['user', 'name']

class TransformerMeasurement(models.Model):
    transformer = models.ForeignKey(Transformer, on_delete=models.CASCADE, related_name='measurements')
    co = models.FloatField()
    h2 = models.FloatField()
    c2h2 = models.FloatField()
    c2h4 = models.FloatField()
    fdd = models.FloatField(null=True, blank=True)
    rul = models.FloatField(null=True, blank=True)
    temperature = models.FloatField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=False, default=timezone.now)

    # def compute_fdd_rul(self):
    #     try:
    #         input_features = np.array([
    #             self.h2, self.co, self.c2h4, self.c2h2
    #         ]).reshape(1, -1)

    #         # Predict RUL and FDD
    #         rul_prediction  =RUL_MODEL.predict(input_features)[0]
    #         fdd_prediction =  FDD_MODEL.predict(input_features)[0]
    #         print(f"input = {input_features}")
    #         print(f"fdd,rul = {rul_prediction}, {fdd_prediction}")
    #         self.rul = float(rul_prediction)
    #         self.fdd = float(fdd_prediction)
    #         logger.info(f"Predicted FDD: {self.fdd}, RUL: {self.rul}")
    #     except Exception as e:
    #         logger.error(f"Error computing FDD/RUL: {str(e)}")
    #         raise
    def preprocess_data(self, data,fdd_scaler):
        df = pd.DataFrame(data,index=[0])
        feature_cols = ['H2', 'CO', 'C2H4', 'C2H2']

        # Verify required columns
        missing_cols = [col for col in feature_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns: {missing_cols}")

        # Add ID and time for tsfresh
        df['id'] = 'input'
        df['time'] = df.index

        # Prepare tsfresh data
        ts_data = df[['id', 'time'] + feature_cols]

        # Extract tsfresh features
        extracted_features = extract_features(
            ts_data,
            column_id='id',
            column_sort='time',
            default_fc_parameters=MinimalFCParameters(),
            impute_function=impute
        )

        # Drop highly correlated features (same as training)
        def drop_correlated_features(df, threshold=0.9):
            corr_matrix = df.corr().abs()
            upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
            to_drop = [column for column in upper.columns if any(upper[column] > threshold)]
            return df.drop(columns=to_drop)

        features = drop_correlated_features(extracted_features)

        # Ensure features match training
        expected_features = fdd_scaler.feature_names_in_ if hasattr(fdd_scaler, 'feature_names_in_') else features.columns
        missing_features = [f for f in expected_features if f not in features.columns]
        if missing_features:
            raise ValueError(f"Missing features: {missing_features}")

        # Add missing columns with zeros if necessary
        for f in expected_features:
            if f not in features.columns:
                features[f] = 0

        # Reorder columns to match scaler
        features = features[expected_features]

        # Scale features
        features_scaled = fdd_scaler.transform(features)

        return features_scaled
    
        
    # def compute_fdd_rul(self):
    #     try:
    #         # input_features = np.array([
    #         #     self.h2, self.co, self.c2h4, self.c2h2
    #         # ]).reshape(1, -1)

    #         data = {
    #             'h2': self.h2,
    #             'co': self.co,
    #             'c2h4': self.c2h4,
    #             'c2h2': self.c2h2
    #         }
    #         features_scaled_fdd = self.preprocess_data(data,FDD_SCALER)
    #          # Make prediction
    #         pred = FDD_MODEL.predict(features_scaled_fdd)[0]
    #         probs = FDD_MODEL.predict_proba(features_scaled_fdd)[0]

    #         # Decode prediction
    #         pred_label = le.inverse_transform([pred])[0]
                
    #         # Predict RUL and FDD
           
    #         # print(f"input = {input_features}")
    #         print(f"fdd,rul = {pred_label}")
    #         self.rul = pred
    #         self.fdd = pred
    #         logger.info(f"Predicted FDD: {self.fdd}, RUL: {self.rul}")
    #     except Exception as e:
    #         logger.error(f"Error computing FDD/RUL: {str(e)}")
    #         raise

    # def compute_fdd_rul(self):
    #     import requests
    #     response = requests.post("https://wicked-donkeys-yawn.loca.lt/predict", json={"H2": self.h2, "CO":self.co, "C2H2":self.c2h4, "C2H4":self.c2h2})
    #     data = response.json()
        
    #     self.fdd = data['fdd']['predicted_class']
    #     self.rul = data['rul']['predicted_rul']
    def compute_fdd_rul(self):
        import requests
        response = requests.post("https://full-mugs-wave.loca.lt/predict", json={
            "H2": self.h2,
            "CO": self.co,
            "C2H4": self.c2h4,
            "C2H2": self.c2h2
        })
        data = response.json()
        self.fdd = data['fdd']['predicted_class']
        self.rul = data['rul']['predicted_rul']


    def save(self, *args, **kwargs):
        # if self.co is not None and self.h2 is not None and self.c2h2 is not None and self.c2h4 is not None:
        self.compute_fdd_rul()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.transformer.name} - FDD: {self.fdd}, RUL: {self.rul} at {self.timestamp}"

class SupportSession(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='support_sessions')
    title = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_resolved = models.BooleanField(default=False)

    def __str__(self):
        return f"Support request from {self.user.username} at {self.created_at}"

class SupportMessage(models.Model):
    session = models.ForeignKey(SupportSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Message from {self.sender.username} at {self.timestamp}"

    class Meta:
        ordering = ['timestamp']

class AdminNotification(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='notifications')
    session = models.ForeignKey(SupportSession, on_delete=models.CASCADE, related_name='notifications')
    message = models.ForeignKey(SupportMessage, on_delete=models.CASCADE, related_name='notifications')
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    is_for_admin = models.BooleanField(default=True)  # True if for admin, False if for regular user

    def __str__(self):
        return f"Notification for {self.user.username} about message from {self.message.sender.username}"

    class Meta:
        ordering = ['-created_at']

class AIConversation(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

class AIMessage(models.Model):
    conversation = models.ForeignKey(AIConversation, related_name='messages', on_delete=models.CASCADE)
    role = models.CharField(max_length=20)  # 'user' or 'assistant'
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']
