import React from 'react';
import { useApp } from '@/lib/context';

interface EditableTextProps {
  textKey: string;
  section: string;
  field: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div';
  className?: string;
  multiline?: boolean;
}

export function EditableText({ 
  textKey, 
  section, 
  field, 
  as: Component = 'span', 
  className = '',
  multiline = false
}: EditableTextProps) {
  const { siteData, updateSiteData, isAdmin, lang } = useApp();
  
  // Safely extract the value based on section and field
  let value = "";
  try {
    if (section === 'hero' && field in siteData.hero) value = (siteData.hero as any)[field];
    else if (section === 'gallery' && field in siteData.gallery) value = (siteData.gallery as any)[field];
    else if (section === 'footer' && field in siteData.footer) value = (siteData.footer as any)[field];
    else value = textKey; // fallback
  } catch (e) {
    value = textKey;
  }

  const handleInput = (e: React.FormEvent<HTMLElement>) => {
    if (!isAdmin) return;
    const newValue = e.currentTarget.textContent || '';
    
    // Create deep copy
    const newData = JSON.parse(JSON.stringify(siteData));
    if (section === 'hero') newData.hero[field] = newValue;
    else if (section === 'gallery') newData.gallery[field] = newValue;
    else if (section === 'footer') newData.footer[field] = newValue;
    
    updateSiteData(newData);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (!multiline) {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain').replace(/\n/g, ' ');
      document.execCommand('insertText', false, text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!multiline && e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <Component
      className={`${className} ${isAdmin ? 'admin-editable' : ''}`}
      contentEditable={isAdmin}
      suppressContentEditableWarning
      onInput={handleInput}
      onPaste={handlePaste}
      onKeyDown={handleKeyDown}
      onBlur={handleInput}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      {value}
    </Component>
  );
}
