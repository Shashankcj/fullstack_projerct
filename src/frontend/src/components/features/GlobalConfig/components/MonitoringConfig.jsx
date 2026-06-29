import React, { useState, useMemo } from 'react';
import GenericConfiguration from './GenericConfiguration';
import { monitoringConfigSections } from '../utils/configDefinitions';
import { ChevronDown } from 'lucide-react';

const MonitoringConfig = ({ isDarkMode, existingConfig }) => {
  const [activeCard, setActiveCard] = useState('p1');

  const getHeaderClasses = (cardId) => {
    const baseClasses = 'px-4 py-3 font-medium flex items-center justify-between cursor-pointer';
    if (isDarkMode) {
      const colors = {
        p1: 'bg-red-900/60 hover:bg-red-800/50 text-red-200',
        p2: 'bg-orange-900/60 hover:bg-orange-800/50 text-orange-200',
        p3: 'bg-yellow-900/60 hover:bg-yellow-800/50 text-yellow-200',
        p4: 'bg-green-900/60 hover:bg-green-800/50 text-green-200',
        default: 'bg-gray-750 hover:bg-gray-700 text-white',
      };
      return `${baseClasses} ${colors[cardId] || colors.default}`;
    } else {
      const colors = {
        p1: 'bg-red-100 hover:bg-red-100 text-red-800',
        p2: 'bg-orange-100 hover:bg-orange-100 text-orange-800',
        p3: 'bg-yellow-100 hover:bg-yellow-100 text-yellow-800',
        p4: 'bg-green-100 hover:bg-green-100 text-green-800',
        default: 'bg-gray-50 hover:bg-gray-100 text-gray-800',
      };
      return `${baseClasses} ${colors[cardId] || colors.default}`;
    }
  };

  const cardSpecificConfig = useMemo(() => {
    if (!existingConfig) return null;
    const config = { ...existingConfig };
    monitoringConfigSections.forEach((section) => {
      section.fields.forEach((field) => {
        const defaultKey = field.apiKey;
        if (activeCard !== 'default') {
          const cardSpecificKey = field.apiKey.replace('monitoring.', `monitoring_${activeCard}.`);
          config[field.key] =
            existingConfig[cardSpecificKey] ||
            existingConfig[defaultKey] ||
            '';
        } else {
          config[field.key] = existingConfig[defaultKey] || '';
        }
      });
    });
    return config;
  }, [activeCard, existingConfig]);

  const cardSections = useMemo(() => {
    return monitoringConfigSections.map((section) => ({
      ...section,
      fields: section.fields.map((field) => {
        const newField = { ...field };
        if (activeCard !== 'default') {
          newField.apiKey = field.apiKey.replace('monitoring.', `monitoring_${activeCard}.`);
        }
        return newField;
      }),
    }));
  }, [activeCard]);

  // ✅ Inject layout hint into sections:
  // sections[0] and [1] get splitLayout: true so GenericConfiguration
  // knows to render them side-by-side with a divider
  const layoutSections = useMemo(() => {
    return [
      { ...cardSections[0], splitLayout: 'left' },
      { ...cardSections[1], splitLayout: 'right' },
      { ...cardSections[2] },
    ];
  }, [cardSections]);

  return (
    <div className="space-y-3">
      {[
        { id: 'p1', label: 'Priority 1 Monitoring Settings' },
        { id: 'p2', label: 'Priority 2 Monitoring Settings' },
        { id: 'p3', label: 'Priority 3 Monitoring Settings' },
        { id: 'p4', label: 'Priority 4 Monitoring Settings' },
        { id: 'default', label: 'Default Settings' },
      ].map((card) => (
        <div
          key={card.id}
          className={`rounded-lg border overflow-hidden shadow-sm transition-all hover:shadow-md ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}
        >
          <div
            className={getHeaderClasses(card.id)}
            onClick={() => setActiveCard(activeCard === card.id ? null : card.id)}
          >
            <span className="font-semibold text-sm truncate">{card.label}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${
                activeCard === card.id ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </div>

          <div
            className={`transition-all duration-300 overflow-hidden ${
              activeCard === card.id ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            {activeCard === card.id && cardSpecificConfig && (
              <div
                className="p-3"
                onClick={(e) => e.stopPropagation()}
              >
                {/* GenericConfiguration */}
                <GenericConfiguration
                  isDarkMode={isDarkMode}
                  configType="monitoring"
                  sections={layoutSections}
                  existingConfig={cardSpecificConfig}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MonitoringConfig;