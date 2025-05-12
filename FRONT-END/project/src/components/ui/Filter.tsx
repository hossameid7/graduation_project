interface FilterOption {
  label: string;
  value: string | number;
}

interface FilterProps {
  label?: string;
  options: FilterOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  className?: string;
}

export default function Filter({
  label,
  options,
  value,
  onChange,
  className = ''
}: FilterProps) {
  const { isDarkMode } = useThemeStore();

  return (
    <div className={className}>
      {label && (
        <label className={`block text-sm font-medium mb-1 ${
          isDarkMode ? 'text-dark-secondary' : 'text-gray-700'
        }`}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`block w-full px-3 py-2 rounded-lg border ${
          isDarkMode 
            ? 'bg-dark-paper border-dark text-dark-primary' 
            : 'bg-white border-gray-300 text-gray-900'
        } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`}
      >
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value}
            className={isDarkMode ? 'bg-dark-paper text-dark-primary' : 'bg-white text-gray-900'}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}