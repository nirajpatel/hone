import { useState, useRef, useEffect } from 'react';
import { Input } from './input';

interface AutocompleteOption {
  value: string;
  line1: string;
  line2?: string;
}

interface AutocompleteDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  defaultOptions?: AutocompleteOption[]; // Limited set to show when not searching
  placeholder?: string;
  onFocus?: () => void;
  className?: string;
  disabled?: boolean;
  getDropdownLabel?: (searchQuery: string) => string;
}

export function AutocompleteDropdown({
  value,
  onChange,
  options,
  defaultOptions,
  placeholder = '',
  onFocus,
  className = '',
  disabled = false,
  getDropdownLabel,
}: AutocompleteDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the selected option
  const selectedOption = options.find(opt => opt.value === value);

  // Filter options based on search query (search by line1 which is "roaster - name")
  const filteredOptions = searchQuery
    ? options.filter(opt =>
        opt.line1.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : defaultOptions || options;

  // Display value in input
  const displayValue = showDropdown ? searchQuery : (selectedOption?.line1 || '');

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text;
    
    const before = text.slice(0, index);
    const match = text.slice(index, index + query.length);
    const after = text.slice(index + query.length);
    
    return (
      <>
        {before}
        <span className="font-bold">{match}</span>
        {after}
      </>
    );
  };

  // Handle input focus
  const handleFocus = () => {
    setShowDropdown(true);
    setSearchQuery('');
    setHighlightedIndex(-1);
    // Select all text so typing replaces the selection
    setTimeout(() => inputRef.current?.select(), 0);
    if (onFocus) onFocus();
  };

  // Handle input click - open dropdown even if already focused
  const handleClick = () => {
    if (!showDropdown) {
      setShowDropdown(true);
      setSearchQuery('');
      setHighlightedIndex(-1);
      // Select all text so typing replaces the selection
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // If dropdown is closed and user is typing, open it and clear selection
    if (!showDropdown) {
      setShowDropdown(true);
      if (value) {
        onChange('');
      }
      setSearchQuery(newValue);
    } else {
      setSearchQuery(newValue);
    }
  };

  // Handle input blur
  const handleBlur = () => {
    setTimeout(() => {
      setShowDropdown(false);
      setSearchQuery('');
      setHighlightedIndex(-1);
    }, 200);
  };

  // Handle option selection
  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setShowDropdown(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  // Handle option pointer down (for better mobile responsiveness)
  const handleOptionPointerDown = (e: React.PointerEvent, optionValue: string) => {
    e.preventDefault(); // Prevent blur from firing
    handleSelect(optionValue);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || filteredOptions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowDropdown(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && dropdownRef.current) {
      const highlightedElement = dropdownRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  return (
    <div className={`relative ${className}`}>
      <Input
        ref={inputRef}
        value={displayValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onClick={handleClick}
      />
      {showDropdown && filteredOptions.length > 0 && (
        <div
          className="absolute z-10 mt-1 left-0 right-0 bg-white border border-gray-300 rounded-md shadow-lg overflow-hidden"
        >
          {getDropdownLabel && (
            <div className="px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b">
              {getDropdownLabel(searchQuery)}
            </div>
          )}
          <div ref={dropdownRef}>
            {filteredOptions.map((option, index) => (
              <div
                key={option.value}
                className={`px-3 py-2 cursor-pointer border-b last:border-b-0 ${
                  index === highlightedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelect(option.value)}
                onPointerDown={(e) => handleOptionPointerDown(e, option.value)}
              >
                <div className="flex flex-col items-start">
                  <div className="text-sm">
                    {highlightMatch(option.line1, searchQuery)}
                  </div>
                  {option.line2 && (
                    <div className="text-sm text-gray-500">
                      {option.line2}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}