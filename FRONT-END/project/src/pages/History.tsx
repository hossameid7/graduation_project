import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import { Activity, Download, Search, Trash2, Mail } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../lib/axios';
import { formatRUL } from '../utils/durationFormatter';
import { useThemeStore } from '../stores/theme';

interface Measurement {
  id: number;
  timestamp: string;
  h2: number;
  co: number;
  c2h2: number;
  c2h4: number;
  fdd: number;
  rul: number;
  temperature?: number;
  transformer: number;
}

interface Transformer {
  id: number;
  name: string;
  user: number;
}

interface TransformerViewProps {
  transformerId: number;
  onClose: () => void;
  measurements: Measurement[];
  transformer: Transformer;
  isDarkMode: boolean;
}

const getFDDStatusInfo = (fdd: number, t: (key: string) => string) => {
  switch (fdd) {
    case 1:
      return {
        label: t('normalMode'),
        color: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
        percentage: '100%',
        description: t('normalModeDesc')
      };
    case 2:
      return {
        label: t('partialDischarge'),
        color: 'text-yellow-600',
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        percentage: '75%',
        description: t('partialDischargeDesc')
      };
    case 3:
      return {
        label: t('lowEnergyDischarge'),
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        percentage: '50%',
        description: t('lowEnergyDischargeDesc')
      };
    case 4:
      return {
        label: t('lowTempOverheating'),
        color: 'text-red-600',
        bg: 'bg-red-50',
        border: 'border-red-200',
        percentage: '15%',
        description: t('lowTempOverheatingDesc')
      };
    default:
      return {
        label: 'Unknown',
        color: 'text-gray-600',
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        percentage: '0%',
        description: 'Unknown status'
      };
  }
};

function TransformerView({ transformerId, onClose, measurements, transformer, isDarkMode }: TransformerViewProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: (transformerId: number) => api.delete(`/api/transformers/${transformerId}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transformers'] });
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
    }
  });

  const transformerMeasurements = useMemo(() => {
    const filtered = measurements?.filter(m => m.transformer === transformerId) || [];
    // Sort measurements by timestamp in ascending order (oldest first)
    return [...filtered].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ).map(m => ({
      ...m,
      timestamp: format(new Date(m.timestamp), 'yyyy-MM-dd HH:mm:ss')
    }));
  }, [measurements, transformerId]);
  
  const latestMeasurement = transformerMeasurements.length > 0 ? 
    transformerMeasurements[transformerMeasurements.length - 1] : null;

  if (!transformer) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <p>{t('pages.history.transformerDataNotFound')}</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            {t('pages.history.close')}
          </button>
        </div>
      </div>
    );
  }
  
  const generatePDF = async () => {
    let doc = new jsPDF();
    const currentLanguage = i18n.language;

    // Language-specific font loading and configuration
    if (currentLanguage === 'ar') {
      doc = await generateArabicPDF(doc);
    } else if (currentLanguage === 'ru') {
      doc = await generateRussianPDF(doc);
    } else {
      // Default to standard Latin font for English and other languages
      await generateDefaultPDF(doc);
    }

    // Save the PDF with appropriate name
    doc.save(`transformer-${transformer.name}-report.pdf`);
  };

  // Arabic PDF generation with proper right-to-left support
  const generateArabicPDF = async (doc: jsPDF) => {
    try {
      // Create a temporary container for the Arabic content
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.direction = 'rtl';  // Set RTL for Arabic
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      // Add the HTML content for the report
      tempDiv.innerHTML = `
        <div style="width: 595px; padding: 20px; background: #fff; color: #000; font-family: Arial, sans-serif;">
          <h1 style="font-size: 20px; margin-bottom: 20px; text-align: right;">
            ${t('pages.history.transformerReport')}: ${transformer.name}
          </h1>
          
          ${latestMeasurement ? `
            <h2 style="font-size: 16px; margin-top: 20px; text-align: right;">
              ${t('pages.history.latestMeasurement')}
            </h2>
            <div style="font-size: 12px; line-height: 1.5; text-align: right;">
              <p><strong>${t('pages.history.fddStatus')}:</strong> ${getFDDStatusInfo(latestMeasurement.fdd, t).label}</p>
              <p><strong>${t('pages.history.fddStatusDescription')}:</strong> ${getFDDStatusInfo(latestMeasurement.fdd, t).description}</p>
              <p><strong>${t('pages.history.rul')}:</strong> ${formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}</p>
              <p><strong>${t('pages.history.timestamp')}:</strong> ${format(new Date(latestMeasurement.timestamp), 'HH:mm yyyy/MM/dd')}</p>
            </div>
          ` : ''}
          

          <div style="overflow-x: hidden; max-width: 555px;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; direction: rtl; font-size: 10px;">
              <thead>
                <tr style="background-color: #4285F4; color: white;">
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 18%;">${t('pages.history.headers.timestamp')}</th>
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.co')}</th>
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.h2')}</th>
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.c2h2')}</th>
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.c2h4')}</th>
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.fdd')}</th>
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 30%;">${t('pages.history.headers.rul')}</th>
                  <th style="padding: 5px; text-align: right; border: 1px solid #ddd; width: 17%;">${t('pages.history.headers.temp')}</th>
                </tr>
              </thead>
              <tbody>
                ${transformerMeasurements.map(m => `
                  <tr>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${format(new Date(m.timestamp), 'MM/dd/yyyy HH:mm')}</td>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${m.co}</td>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${m.h2}</td>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${m.c2h2}</td>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${m.c2h4}</td>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${m.fdd}</td>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd; word-break: break-word;">${formatRUL(m.rul, { t, i18n, useGrammarRules: true })}</td>
                    <td style="padding: 5px; text-align: right; border: 1px solid #ddd;">${m.temperature ?? '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      
      // Add the div to the body so it can be rendered
      document.body.appendChild(tempDiv);
      
      // Use html2canvas to convert the HTML to canvas
      try {
        const canvas = await html2canvas(tempDiv, {
          scale: 2, // Higher scale for better quality
          useCORS: true,
          logging: false,
          width: 595, // Match PDF width
          height: tempDiv.offsetHeight
        });
        
        // Convert canvas to image
        const imgData = canvas.toDataURL('image/png');
        
        // Reset the PDF object to ensure clean state
        doc = new jsPDF();
        
        // Calculate the width and height to maintain aspect ratio
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        // Check if the content is too tall for one page
        const maxHeight = doc.internal.pageSize.getHeight();
        
        if (pdfHeight <= maxHeight) {
          // Content fits on one page
          doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        } else {
          // Content needs multiple pages
          let heightLeft = pdfHeight;
          let position = 0;
          let page = 1;
          
          // Add first page
          doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= maxHeight;
          
          // Add subsequent pages if needed
          while (heightLeft > 0) {
            position = -maxHeight * page;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= maxHeight;
            page++;
          }
        }
        
      } catch (canvasError) {
        console.error("Error during html2canvas rendering:", canvasError);
        throw canvasError;
      } finally {
        // Clean up the temporary div
        document.body.removeChild(tempDiv);
      }
      
    } catch (error) {
      console.error("Error generating Arabic PDF with html2canvas:", error);
      
      // Fallback to traditional methods
      try {
        console.log("Falling back to traditional PDF generation for Arabic");
        generateDefaultPDF(doc);
      } catch (fallbackError) {
        console.error("Error with PDF fallback method:", fallbackError);
      }
    }
    
    return doc;
  };

  // Russian PDF generation with Cyrillic support
  const generateRussianPDF = async (doc: jsPDF) => {
    try {
      // Create a temporary container for the Russian content
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      
      // Add the HTML content for the report
      tempDiv.innerHTML = `
        <div style="width: 595px; padding: 20px; background: #fff; color: #000; font-family: Arial, sans-serif;">
          <h1 style="font-size: 20px; margin-bottom: 20px;">
            ${t('pages.history.transformerReport')}: ${transformer.name}
          </h1>
          
          ${latestMeasurement ? `
            <h2 style="font-size: 16px; margin-top: 20px;">
              ${t('pages.history.latestMeasurement')}
            </h2>
            <div style="font-size: 12px; line-height: 1.5;">
              <p><strong>${t('pages.history.fddStatus')}:</strong> ${getFDDStatusInfo(latestMeasurement.fdd, t).label}</p>
              <p><strong>${t('pages.history.fddStatusDescription')}:</strong> ${getFDDStatusInfo(latestMeasurement.fdd, t).description}</p>
              <p><strong>${t('pages.history.rul')}:</strong> ${formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}</p>
              <p><strong>${t('pages.history.timestamp')}:</strong> ${format(new Date(latestMeasurement.timestamp), 'HH:mm yyyy/MM/dd')}</p>
            </div>
          ` : ''}
          
         
          <div style="overflow-x: hidden; max-width: 555px;">
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px;">
              <thead>
                <tr style="background-color: #4285F4; color: white;">
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 18%;">${t('pages.history.headers.timestamp')}</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.co')}</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.h2')}</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.c2h2')}</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.c2h4')}</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 7%;">${t('pages.history.headers.fdd')}</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 30%;">${t('pages.history.headers.rul')}</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #ddd; width: 17%;">${t('pages.history.headers.temp')}</th>
                </tr>
              </thead>
              <tbody>
                ${transformerMeasurements.map(m => `
                  <tr>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd;">${format(new Date(m.timestamp), 'MM/dd/yyyy HH:mm')}</td>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd;">${m.co}</td>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd;">${m.h2}</td>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd;">${m.c2h2}</td>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd;">${m.c2h4}</td>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd;">${m.fdd}</td>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd; word-break: break-word;">${formatRUL(m.rul, { t, i18n, useGrammarRules: true })}</td>
                    <td style="padding: 5px; text-align: left; border: 1px solid #ddd;">${m.temperature ?? '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      
      // Add the div to the body so it can be rendered
      document.body.appendChild(tempDiv);
      
      // Use html2canvas to convert the HTML to canvas
      try {
        const canvas = await html2canvas(tempDiv, {
          scale: 2, // Higher scale for better quality
          useCORS: true,
          logging: false,
          width: 595, // Match PDF width
          height: tempDiv.offsetHeight
        });
        
        // Convert canvas to image
        const imgData = canvas.toDataURL('image/png');
        
        // Reset the PDF object to ensure clean state
        doc = new jsPDF();
        
        // Calculate the width and height to maintain aspect ratio
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        // Check if the content is too tall for one page
        const maxHeight = doc.internal.pageSize.getHeight();
        
        if (pdfHeight <= maxHeight) {
          // Content fits on one page
          doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        } else {
          // Content needs multiple pages
          let heightLeft = pdfHeight;
          let position = 0;
          let page = 1;
          
          // Add first page
          doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
          heightLeft -= maxHeight;
          
          // Add subsequent pages if needed
          while (heightLeft > 0) {
            position = -maxHeight * page;
            doc.addPage();
            doc.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
            heightLeft -= maxHeight;
            page++;
          }
        }
        
      } catch (canvasError) {
        console.error("Error during html2canvas rendering for Russian:", canvasError);
        throw canvasError;
      } finally {
        // Clean up the temporary div
        document.body.removeChild(tempDiv);
      }
      
    } catch (error) {
      console.error("Error generating Russian PDF with html2canvas:", error);
      
      // Fallback to traditional methods
      try {
        console.log("Falling back to traditional PDF generation for Russian");
        generateDefaultPDF(doc);
      } catch (fallbackError) {
        console.error("Error with PDF fallback method:", fallbackError);
      }
    }
    
    return doc;
  };

  // Generate PDF using HTML for better language support
  const generatePDFUsingHTML = async (doc: jsPDF) => {
    // Create an HTML string with all the content
    // This will have better Unicode support
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; font-size: 16px; color: #000000;">
        <h1 style="font-size: 20px; margin-bottom: 20px;">${t('pages.history.transformerReport')}: ${transformer.name}</h1>
        
        ${latestMeasurement ? `
          <h2 style="font-size: 16px; margin-top: 20px;">${t('pages.history.latestMeasurement')}</h2>
          <div style="font-size: 12px; line-height: 1.5;">
            <p><strong>${t('pages.history.fddStatus')}:</strong> ${getFDDStatusInfo(latestMeasurement.fdd, t).label}</p>
            <p><strong>${t('pages.history.fddStatusDescription')}:</strong> ${getFDDStatusInfo(latestMeasurement.fdd, t).description}</p>
            <p><strong>${t('pages.history.rul')}:</strong> ${formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}</p>
            <p><strong>${t('pages.history.timestamp')}:</strong> ${format(new Date(latestMeasurement.timestamp), 'HH:mm yyyy/MM/dd')}</p>
          </div>
        ` : ''}
        
        <h2 style="font-size: 16px; margin-top: 20px;">${t('pages.history.headers.timestamp')}</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px;">
          <thead>
            <tr style="background-color: #4285F4; color: white;">
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.timestamp')}</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.co')}</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.h2')}</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.c2h2')}</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.c2h4')}</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.fdd')}</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.rul')}</th>
              <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">${t('pages.history.headers.temp')}</th>
            </tr>
          </thead>
          <tbody>
            ${transformerMeasurements.map(m => `
              <tr>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${format(new Date(m.timestamp), 'MM/dd/yyyy HH:mm')}</td>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${m.co}</td>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${m.h2}</td>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${m.c2h2}</td>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${m.c2h4}</td>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${m.fdd}</td>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${formatRUL(m.rul, { t, i18n, useGrammarRules: true })}</td>
                <td style="padding: 8px; text-align: left; border: 1px solid #ddd;">${m.temperature ?? '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    // Create a temporary HTML element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);
    
    // Use html2canvas or similar library to convert HTML to image
    // For demo purposes, we'll use the standard approach
    
    // Clean up
    document.body.removeChild(tempDiv);
    
    // For now, fallback to the standard method
    createRussianPDFContent(doc);
  };

  // Default PDF generation for Latin languages
  const generateDefaultPDF = async (doc: jsPDF) => {
    doc.setFont("helvetica");
    doc.setR2L(false);
    generatePDFContent(doc);
  };

  // Common PDF content generation function
  const generatePDFContent = (doc: jsPDF, isCyrillic = false) => {
    // Set font size for title
    doc.setFontSize(16);
    
    // Set text color to black
    doc.setTextColor(0);
    
    // Helper function to encode Cyrillic text correctly
    const prepareText = (text: string): string => {
      if (isCyrillic) {
        // For Cyrillic, we need to handle the text differently
        // We'll just return the text as-is since we're using a different approach
        return text;
      }
      return text;
    };
    
    // For Cyrillic, we need to handle text differently
    if (isCyrillic) {
      // Create PDF using a different approach for Russian
      createRussianPDFContent(doc);
      return;
    }
    
    // Add title
    const reportTitle = `${t('pages.history.transformerReport')}: ${transformer.name}`;
    doc.text(prepareText(reportTitle), 20, 20);

    if (latestMeasurement) {
      doc.setFontSize(14);
      doc.text(prepareText(t('pages.history.latestMeasurement')), 20, 40);
      doc.setFontSize(10);
      
      const fddStatusText = `${t('pages.history.fddStatus')}: ${getFDDStatusInfo(latestMeasurement.fdd, t).label}`;
      doc.text(prepareText(fddStatusText), 20, 50);
      
      const fddDescText = `${t('pages.history.fddStatusDescription')}: ${getFDDStatusInfo(latestMeasurement.fdd, t).description}`;
      doc.text(prepareText(fddDescText), 20, 60);
      
      const rulText = `${t('pages.history.rul')}: ${formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}`;
      doc.text(prepareText(rulText), 20, 70);
      
      const timestampText = `${t('pages.history.timestamp')}: ${format(new Date(latestMeasurement.timestamp), 'HH:mm yyyy/MM/dd')}`;
      doc.text(prepareText(timestampText), 20, 80);
    }

    // Prepare table data with proper text encoding
    const tableData = transformerMeasurements.map(m => [
      format(new Date(m.timestamp), 'MM/dd/yyyy HH:mm'),
      m.co.toString(),
      m.h2.toString(),
      m.c2h2.toString(),
      m.c2h4.toString(),
      m.fdd.toString(),
      formatRUL(m.rul, { t, i18n, useGrammarRules: true }),
      m.temperature?.toString() ?? '-',
    ]);

    // Configure table options based on language
    const tableOptions: any = {
      startY: 90,
      head: [[
        prepareText(t('pages.history.headers.timestamp')),
        prepareText(t('pages.history.headers.co')),
        prepareText(t('pages.history.headers.h2')),
        prepareText(t('pages.history.headers.c2h2')),
        prepareText(t('pages.history.headers.c2h4')),
        prepareText(t('pages.history.headers.fdd')),
        prepareText(t('pages.history.headers.rul')),
        prepareText(t('pages.history.headers.temp'))
      ]],
      body: tableData,
      styles: {
        font: doc.getFont().fontName,
        textColor: '#000000'
      },
      headStyles: {
        fillColor: '#4285F4',
        textColor: '#FFFFFF',
        halign: i18n.language === 'ar' ? 'right' : 'left'
      },
      bodyStyles: {
        halign: i18n.language === 'ar' ? 'right' : 'left'
      }
    };

    // Generate the table
    autoTable(doc, tableOptions);
  };
  
  // Special function for creating Russian PDF content using direct text rendering
  const createRussianPDFContent = (doc: jsPDF) => {
    // For Russian PDF generation, we'll use a different approach
    // First, set up the basic document properties
    const fontSize = 12;
    const lineHeight = fontSize * 1.5;
    let yPosition = 20;
    
    // Helper function to handle Russian text encoding
    const encodeRussianText = (text: string) => {
      // This converts unicode Cyrillic characters to escaped sequences
      // that PDF can understand
      return text
        .split('')
        .map(char => {
          const code = char.charCodeAt(0);
          // If it's a Cyrillic character, use a transliteration
          if (code >= 0x0410 && code <= 0x044F) {
            // We'll use a basic transliteration for Cyrillic
            const translit: {[key: string]: string} = {
              'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'YO', 
              'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 
              'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 
              'Ф': 'F', 'Х': 'KH', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SCH', 'Ъ': '', 
              'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA',
              'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 
              'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 
              'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 
              'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 
              'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
            };
            return translit[char] || char;
          }
          return char;
        })
        .join('');
    };
    
    // Add title with proper positioning
    const title = `${t('pages.history.transformerReport')}: ${transformer.name}`;
    doc.setFontSize(16);
    doc.text(encodeRussianText(title), 20, yPosition);
    yPosition += lineHeight * 1.5;
    
    if (latestMeasurement) {
      doc.setFontSize(14);
      doc.text(encodeRussianText(t('pages.history.latestMeasurement')), 20, yPosition);
      yPosition += lineHeight;
      
      doc.setFontSize(fontSize);
      
      // Status line
      const statusLine = `${t('pages.history.fddStatus')}: ${getFDDStatusInfo(latestMeasurement.fdd, t).label}`;
      doc.text(encodeRussianText(statusLine), 20, yPosition);
      yPosition += lineHeight;
      
      // Description line - may need wrapping
      const descLine = `${t('pages.history.fddStatusDescription')}: ${getFDDStatusInfo(latestMeasurement.fdd, t).description}`;
      doc.text(encodeRussianText(descLine), 20, yPosition, { maxWidth: 170 });
      yPosition += descLine.length > 80 ? lineHeight * 2 : lineHeight;
      
      // RUL line
      const rulLine = `${t('pages.history.rul')}: ${formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}`;
      doc.text(encodeRussianText(rulLine), 20, yPosition);
      yPosition += lineHeight;
      
      // Timestamp line
      const timestampLine = `${t('pages.history.timestamp')}: ${format(new Date(latestMeasurement.timestamp), 'HH:mm yyyy/MM/dd')}`;
      doc.text(encodeRussianText(timestampLine), 20, yPosition);
      yPosition += lineHeight * 1.5;
    }
    
    // Create table with measurements
    const tableHeaders = [
      encodeRussianText(t('pages.history.headers.timestamp')),
      encodeRussianText(t('pages.history.headers.co')),
      encodeRussianText(t('pages.history.headers.h2')),
      encodeRussianText(t('pages.history.headers.c2h2')),
      encodeRussianText(t('pages.history.headers.c2h4')),
      encodeRussianText(t('pages.history.headers.fdd')),
      encodeRussianText(t('pages.history.headers.rul')),
      encodeRussianText(t('pages.history.headers.temp'))
    ];
    
    const tableData = transformerMeasurements.map(m => [
      format(new Date(m.timestamp), 'MM/dd/yyyy HH:mm'),
      m.co.toString(),
      m.h2.toString(),
      m.c2h2.toString(),
      m.c2h4.toString(),
      m.fdd.toString(),
      encodeRussianText(formatRUL(m.rul, { t, i18n, useGrammarRules: true })),
      m.temperature?.toString() ?? '-',
    ]);
    
    // Use autotable with specific settings for Russian
    autoTable(doc, {
      startY: yPosition,
      head: [tableHeaders],
      body: tableData,
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: '#000000'
      },
      headStyles: {
        fillColor: '#4285F4',
        textColor: '#FFFFFF',
        fontSize: 10
      },
      columnStyles: {
        6: { cellWidth: 40 } // Wider column for RUL which can be longer in Russian
      }
    });
  };

  // Helper function to convert ArrayBuffer to Base64
  function arrayBufferToBase64(buffer: ArrayBuffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
  }


  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto`}>
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
        <div className={`sticky top-0 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b p-4`}>
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} mb-4`}>
            {transformer.name}
          </h2>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={generatePDF}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Download size={16} />
              {t('pages.history.downloadPDF')}
            </button>
            <button
              onClick={() => {
                // Create HTML content for email
                const htmlContent = `
                  <html>
                    <head>
                      <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
                        .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
                        .status { padding: 8px 16px; border-radius: 20px; display: inline-block; margin-bottom: 16px; }
                        .normal { background-color: #f0fdf4; color: #166534; }
                        .warning { background-color: #fef3c7; color: #92400e; }
                        .critical { background-color: #fee2e2; color: #991b1b; }
                        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px; }
                        .label { color: #6b7280; font-size: 14px; }
                        .value { font-weight: 600; color: #111827; }
                      </style>
                    </head>
                    <body>
                      <div class="container">
                        <div class="header">${transformer.name} - Status Report</div>
                        ${latestMeasurement ? `
                          <div class="card">
                            <div class="status ${getFDDStatusInfo(latestMeasurement.fdd, t).label.toLowerCase()}">
                              ${getFDDStatusInfo(latestMeasurement.fdd, t).label}
                            </div>
                            <div class="grid">
                              <div>
                                <div class="label">${t('pages.history.fddStatus')}</div>
                                <div class="value">${getFDDStatusInfo(latestMeasurement.fdd, t).label}</div>
                              </div>
                              <div>
                                <div class="label">${t('pages.history.rul')}</div>
                                <div class="value">${formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}</div>
                              </div>
                              <div>
                                <div class="label">${t('pages.history.temperature')}</div>
                                <div class="value">${latestMeasurement.temperature ? `${latestMeasurement.temperature}°C` : 'N/A'}</div>
                              </div>
                              <div>
                                <div class="label">${t('pages.history.timestamp')}</div>
                                <div class="value">${format(new Date(latestMeasurement.timestamp), 'MM/dd/yyyy HH:mm')}</div>
                              </div>
                            </div>
                            <div class="card">
                              <div class="label">${t('pages.history.fddStatusDescription')}</div>
                              <div class="value">${getFDDStatusInfo(latestMeasurement.fdd, t).description}</div>
                            </div>
                          </div>
                        ` : `
                          <div class="card">
                            <p>${t('pages.history.noData')}</p>
                          </div>
                        `}
                      </div>
                    </body>
                  </html>
                `;

                // Send to backend
                api.post('/api/transformers/email_report/', {
                  transformerId: transformer.id,
                  htmlContent: htmlContent
                })
                  .then(() => {
                    alert(t('pages.history.emailSent'));
                  })
                  .catch(() => {
                    alert(t('pages.history.emailError'));
                  });
              }}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1.5"
            >
              <Mail size={16} />
              {t('pages.history.emailReport')}
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                if (window.confirm(t('pages.history.deleteConfirm'))) {
                  deleteMutation.mutate(transformer.id, {
                    onSuccess: () => {
                      alert(t('pages.history.deleteSuccess'));
                      onClose();
                    },
                    onError: () => {
                      alert(t('pages.history.deleteError'));
                    }
                  });
                }
              }}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded hover:bg-red-700 flex items-center gap-1.5"
            >
              <Trash2 size={16} />
              {t('pages.history.deleteTransformer')}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm"
            >
              {t('pages.history.close')}
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg border border-gray-200 p-6`}>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} mb-4`}>
              {t('pages.history.latestMeasurement')}
            </h3>
            {latestMeasurement && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row flex-wrap gap-4 justify-start">
                  {/* Status Card */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-opacity-10' : ''} ${getFDDStatusInfo(latestMeasurement.fdd, t).bg} ${getFDDStatusInfo(latestMeasurement.fdd, t).border} h-auto min-w-0 max-w-xs`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} break-words`}>{t('pages.history.fddStatus')}</p>
                    <p className={`font-semibold ${getFDDStatusInfo(latestMeasurement.fdd, t).color} break-words hyphens-auto`}>
                      {getFDDStatusInfo(latestMeasurement.fdd, t).label}
                    </p>
                  </div>
                  
                  {/* RUL Card */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-blue-900 bg-opacity-20 border-blue-800' : 'bg-blue-50 border-blue-200'} border h-auto min-w-0 max-w-xs`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} break-words`}>{t('pages.history.rul')}</p>
                    <p className="font-semibold text-blue-600 break-words hyphens-auto">
                      {formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}
                    </p>
                  </div>
                  
                  {/* Temperature Card */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border h-auto min-w-0 max-w-xs`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} break-words`}>{t('pages.history.temperature')}</p>
                    <p className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} break-words hyphens-auto`}>
                      {latestMeasurement.temperature ? `${latestMeasurement.temperature}°C` : 'N/A'}
                    </p>
                  </div>
                  
                  {/* Timestamp Card */}
                  <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} border h-auto min-w-0 max-w-xs`}>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} break-words`}>{t('pages.history.timestamp')}</p>
                    <p className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} break-words hyphens-auto`}>
                      {format(new Date(latestMeasurement.timestamp), 'MM/dd/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Gas Concentrations Chart */}
          <div className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'} rounded-lg border border-gray-200 p-6`}>
            <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'} mb-4`}>
              {t('pages.history.gasConcentrations')}
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={transformerMeasurements}>
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={isDarkMode ? '#374151' : '#e5e7eb'} 
                  />
                  <XAxis 
                    dataKey="timestamp" 
                    
                    tickFormatter={(timestamp) => format(new Date(timestamp), 'MM/dd HH:mm')}
                    stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
                  />
                  <YAxis 
                    stroke={isDarkMode ? '#9ca3af' : '#6b7280'} 
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#e5e7eb' : '#111827'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="co" stroke="#8884d8" name="CO" />
                  <Line type="monotone" dataKey="h2" stroke="#82ca9d" name="H2" />
                  <Line type="monotone" dataKey="c2h2" stroke="#ffc658" name="C2H2" />
                  <Line type="monotone" dataKey="c2h4" stroke="#ff7300" name="C2H4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function History() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTransformerId = searchParams.get('transformer') ? Number(searchParams.get('transformer')) : null;
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { isDarkMode } = useThemeStore();
  
  const { data: measurements } = useQuery<Measurement[]>({
    queryKey: ['measurements'],
    queryFn: async () => {
      const response = await api.get('/api/measurements/');
      return response.data;
    }
  });

  const { data: transformers } = useQuery<Transformer[]>({
    queryKey: ['transformers'],
    queryFn: async () => {
      const response = await api.get('/api/transformers/');
      return response.data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (transformerId: number) => api.delete(`/api/transformers/${transformerId}/`),
    onSuccess: () => {
      // Invalidate and refetch transformers query
      queryClient.invalidateQueries({ queryKey: ['transformers'] });
      queryClient.invalidateQueries({ queryKey: ['measurements'] });
    }
  });

  const handleDelete = async (e: React.MouseEvent, transformerId: number) => {
    e.stopPropagation();
    if (window.confirm(t('pages.history.deleteConfirm'))) {
      try {
        await deleteMutation.mutateAsync(transformerId);
        alert(t('pages.history.deleteSuccess'));
      } catch (error) {
        alert(t('pages.history.deleteError'));
      }
    }
  };

  const filteredTransformers = useMemo(() => {
    if (!transformers) return [];
    return transformers.filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [transformers, searchTerm]);

  const selectedTransformer = transformers?.find(t => t.id === selectedTransformerId);

  const handleClose = () => {
    setSearchParams({});
  };

  if (selectedTransformerId && selectedTransformer && measurements) {
    return (
      <TransformerView
        transformerId={selectedTransformerId}
        transformer={selectedTransformer}
        measurements={measurements}
        onClose={handleClose}
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <div className={`p-6 space-y-6 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        {t('pages.history.title')}
      </h1>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className={`h-5 w-5 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
        </div>
        <input
          type="text"
          placeholder={t('pages.history.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`block w-full pl-10 pr-3 py-2 border rounded-md leading-5 ${
            isDarkMode 
              ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-500' 
              : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
          } focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTransformers.map((transformer) => {
          const latestMeasurement = measurements?.find(m => m.transformer === transformer.id);
          const status = latestMeasurement ? getFDDStatusInfo(latestMeasurement.fdd, t) : null;

          return (
            <div
              key={transformer.id}
              onClick={() => setSearchParams({ transformer: transformer.id.toString() })}
              className={`${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 hover:bg-gray-700' 
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              } rounded-lg shadow-md border p-6 transition-shadow cursor-pointer`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  {transformer.name}
                </h3>
                <div className="flex items-center gap-2 justify-end">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              
              {latestMeasurement ? (
                <>
                  <div className="flex justify-between items-start">
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                      isDarkMode ? 'bg-opacity-10' : ''
                    } ${status?.color} ${status?.bg}`}>
                      {status?.label}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => handleDelete(e, transformer.id)}
                        className={`p-2 text-red-600 hover:text-red-800 ${
                          isDarkMode ? 'hover:bg-red-900 hover:bg-opacity-20' : 'hover:bg-red-50'
                        } rounded-full`}
                        title={t('pages.history.deleteTransformer')}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('pages.history.rul')}:
                      </span>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                        {formatRUL(latestMeasurement.rul, { t, i18n, useGrammarRules: true })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {t('pages.history.timestamp')}:
                      </span>
                      <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                        {format(new Date(latestMeasurement.timestamp), 'MM/dd/yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mt-2`}>
                  {t('pages.history.noData')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
