import { useState, ReactElement, ChangeEvent, FormEvent, MouseEvent, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../lib/axios';
import { formatRUL } from '../utils/durationFormatter';
import { useThemeStore } from '../stores/theme';

interface FormData {
  transformer: string;
  co: string;
  h2: string;
  c2h2: string;
  c2h4: string;
  temperature: string;
}

interface MeasurementInput {
  transformer: number;
  co: number;
  h2: number;
  c2h2: number;
  c2h4: number;
  temperature?: number | null;
}

interface MeasurementResponse {
  id: number;
  transformer: number;
  co: number;
  h2: number;
  c2h2: number;
  c2h4: number;
  temperature: number | null;
  fdd: number;
  rul: number;
  timestamp: string;
}

interface Transformer {
  id: number;
  name: string;
  user: number;
}

interface HealthStatus {
  label: string;
  color: string;
  bg: string;
  border: string;
  description: string;
}

export default function NewMeasurement(): ReactElement {
  const { t, i18n } = useTranslation();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const [formData, setFormData] = useState<FormData>({
    transformer: '',
    co: '',
    h2: '',
    c2h2: '',
    c2h4: '',
    temperature: '',
  });
  const [showResults, setShowResults] = useState(false);
  const [predictionResults, setPredictionResults] = useState<MeasurementResponse | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: transformers } = useQuery<Transformer[]>({
    queryKey: ['transformers'],
    queryFn: async () => {
      const response = await api.get('/api/transformers');
      return response.data;
    }
  });

  const mutation = useMutation<MeasurementResponse, Error, MeasurementInput>({
    mutationFn: async (data) => {
      try {
        const response = await api.post('/api/measurements/', data, { timeout: 100000 }); //1000 second
        return response.data;
      } catch (error: any) {
        if (error.response?.status === 401) {
          navigate('/login');
          throw new Error('Please login to submit measurements');
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
      setPredictionResults(data);
      setShowResults(true);
    },
    onError: (error) => {
      console.error('Submission error:', error);
    }
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!formData.transformer) {
      return;
    }
    
    const payload: MeasurementInput = {
      transformer: parseInt(formData.transformer),
      co: parseFloat(formData.co),
      h2: parseFloat(formData.h2),
      c2h2: parseFloat(formData.c2h2),
      c2h4: parseFloat(formData.c2h4),
      temperature: formData.temperature ? parseFloat(formData.temperature) : null,
    };
    mutation.mutate(payload);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setFormData((prevState: FormData): FormData => ({
      ...prevState,
      [name]: value
    }));
  };

  // Check if form has been modified
  const isFormModified = useCallback(() => {
    return formData.transformer !== '' ||
      formData.co !== '' ||
      formData.h2 !== '' ||
      formData.c2h2 !== '' ||
      formData.c2h4 !== '' || 
      formData.temperature !== '';
  }, [formData]);

  // Handle navigation away with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isFormModified() && !showResults) {
        const message = t('pages.newMeasurement.unsavedChanges', 'You have unsaved changes. Are you sure you want to leave?');
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isFormModified, showResults, t]);

  const handleGoToDashboard = useCallback((_e?: MouseEvent<HTMLButtonElement>): void => {
    // If there's an ongoing submission, confirm before navigating away
    if (mutation.isPending) {
      const confirmed = window.confirm(t('pages.newMeasurement.confirmCancel', 'Cancel the current submission?'));
      if (!confirmed) return;
    }
    
    // If form has been modified, ask for confirmation
    if (isFormModified() && !showResults) {
      const confirmed = window.confirm(t('pages.newMeasurement.unsavedChanges', 'You have unsaved changes. Are you sure you want to leave?'));
      if (!confirmed) return;
    }
    
    // Reset form data and navigate to dashboard
    setFormData({
      transformer: '',
      co: '',
      h2: '',
      c2h2: '',
      c2h4: '',
      temperature: '',
    });
    navigate('/dashboard');
  }, [mutation.isPending, isFormModified, showResults, t, navigate]);

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showResults) {
        handleGoToDashboard();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleGoToDashboard, showResults]);

  const handleResetResults = (_e: MouseEvent<HTMLButtonElement>): void => {
    setShowResults(false);
  };

  const getHealthStatus = (fdd: number): HealthStatus => {
    switch (fdd) {
      case 1:
        return {
          label: t('NormalMode'),
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-200',
          description: t('normalModeDesc')
        };
      case 2:
        return {
          label: t('partialDischarge'),
          color: 'text-yellow-600',
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          description: t( 'partialDischargeDesc')
        };
      case 3:
        return {
          label: t('LowEnergyDischarge'),
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          description: t( 'pages.newMeasurement.results.lowEnergyDischargeDescription')
        };
      case 4:
        return {
          label: t('LowtemperatureOverheating'),
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-200',
          description: t('lowTemperatureOverheatingDescription')
        };
      default:
        return {
          label: 'Unknown',
          color: 'text-gray-600',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          description: t('pages.newMeasurement.results.statusUnknown')
        };
    }
  };

  if (showResults && predictionResults) {
    const health = getHealthStatus(predictionResults.fdd);
    const transformer = transformers?.find(t => t.id === predictionResults.transformer);

    return (
      <div className="max-w-2xl mx-auto">
        <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} p-6 rounded-lg shadow-lg border`}>
          <div className="flex items-center justify-between mb-6">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{t('pages.newMeasurement.results.title')}</h1>
            <button
              onClick={handleResetResults}
              className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {/* {t('pages.newMeasurement.form.addAnother')} */}
            </button>
          </div>

          <div className="space-y-6">
            <div className={`p-4 rounded-lg ${isDarkMode ? health.bg.replace('bg-', 'bg-opacity-20 bg-') : health.bg} ${health.border} border`}>
              <div className="flex items-center gap-2 mb-2">
                {health.label === 'Normal mode' ? (
                  <CheckCircle className={`w-5 h-5 ${isDarkMode ? health.color.replace('600', '400') : health.color}`} />
                ) : (
                  <AlertTriangle className={`w-5 h-5 ${isDarkMode ? health.color.replace('600', '400') : health.color}`} />
                )}
                <h2 className={`text-lg font-semibold ${isDarkMode ? health.color.replace('600', '400') : health.color}`}>
                  {t('pages.newMeasurement.results.transformerStatus')}: {health.label}
                </h2>
              </div>
              <p className={`mt-2 ${isDarkMode ? health.color.replace('text-', 'text-').replace('600', '400') : health.color}`}>
                {health.description}
              </p>
            </div>

            <div className={`${isDarkMode ? 'bg-blue-900 bg-opacity-20 border-blue-800' : 'bg-blue-50 border-blue-200'} p-4 rounded-lg border`}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className={`w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {t('pages.newMeasurement.results.remainingLife')}
                </h2>
              </div>
              <p className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                {formatRUL(predictionResults.rul, { t, i18n, useGrammarRules: true })}
              </p>
            </div>

            <div className={`${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} p-4 rounded-lg border`}>
              <h3 className={`font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                {t('pages.newMeasurement.results.measurementDetails')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('pages.newMeasurement.results.transformer')}
                  </p>
                  <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {transformer?.name}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t('pages.newMeasurement.results.timestamp')}
                  </p>
                  <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {new Date(predictionResults.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>H2</p>
                  <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {predictionResults.h2} ppm
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>CO</p>
                  <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {predictionResults.co} ppm
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>C2H2</p>
                  <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {predictionResults.c2h2} ppm
                  </p>
                </div>
                <div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>C2H4</p>
                  <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    {predictionResults.c2h4} ppm
                  </p>
                </div>
                {predictionResults.temperature !== null && (
                  <div>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{t('pages.newMeasurement.results.temperature')}</p>
                    <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                      {predictionResults.temperature}°C
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleGoToDashboard}
                className={`flex-1 px-6 py-2 rounded transition-colors ${
                  isDarkMode 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {t('pages.newMeasurement.form.goToDashboard')}
              </button>
              <button
                onClick={handleResetResults}
                className={`flex-1 px-6 py-2 rounded transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t('pages.newMeasurement.form.addAnother')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
        {t('pages.newMeasurement.title')}
      </h1>
      
      {mutation.error && (
        <div className={`mb-4 p-4 rounded-lg border ${
          isDarkMode 
            ? 'bg-red-900 bg-opacity-20 border-red-800 text-red-400' 
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {mutation.error.message}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={`p-6 rounded-lg shadow-lg border space-y-4 ${
        isDarkMode 
          ? 'bg-gray-800 border-gray-700' 
          : 'bg-white border-gray-200'
      }`}>
        <div>
          <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {t('pages.newMeasurement.form.transformer')}
          </label>
          <select
            name="transformer"
            value={formData.transformer}
            onChange={handleChange}
            className={`w-full p-2 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-200' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
            required
          >
            <option value="">{t('pages.newMeasurement.form.transformer')}</option>
            {transformers?.map((transformer) => (
              <option key={transformer.id} value={transformer.id.toString()}>
                {transformer.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.newMeasurement.form.h2')}
            </label>
            <input
              type="number"
              name="h2"
              value={formData.h2}
              onChange={handleChange}
              step="0.01"
              className={`w-full p-2 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          
          <div>
            <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.newMeasurement.form.co')}
            </label>
            <input
              type="number"
              name="co"
              value={formData.co}
              onChange={handleChange}
              step="0.01"
              className={`w-full p-2 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          <div>
            <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.newMeasurement.form.c2h4')}
            </label>
            <input
              type="number"
              name="c2h4"
              value={formData.c2h4}
              onChange={handleChange}
              step="0.01"
              className={`w-full p-2 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
          <div>
            <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {t('pages.newMeasurement.form.c2h2')}
            </label>
            <input
              type="number"
              name="c2h2"
              value={formData.c2h2}
              onChange={handleChange}
              step="0.01"
              className={`w-full p-2 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300 text-gray-900'
              }`}
              required
            />
          </div>
        </div>
        
        <div>
          <label className={`block mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {t('pages.newMeasurement.form.temperatureOptional')}
          </label>
          <input
            type="number"
            name="temperature"
            value={formData.temperature}
            onChange={handleChange}
            step="0.1"
            className={`w-full p-2 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-200' 
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          />
        </div>
        
        <div className="flex gap-4">
          <button
            type="submit"
            className={`px-6 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-offset-gray-800' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t('loading') : t('pages.newMeasurement.form.submit')}
          </button>
          
          <button
            type="button"
            onClick={handleGoToDashboard}
            className={`px-6 py-2 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 ${
              isDarkMode 
                ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 focus:ring-offset-gray-800' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t('pages.newMeasurement.form.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}