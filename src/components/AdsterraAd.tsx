import React, { useEffect, useRef } from 'react';

interface AdsterraAdProps {
  className?: string;
}

/**
 * Adsterra native banner placement component
 * Safely loads external script with lifecycle management and non-intrusive centered layout
 */
export function AdsterraAd({ className = '' }: AdsterraAdProps) {
  const adWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = adWrapperRef.current;
    if (!wrapper) return;

    // Reset container contents to prevent duplicate elements on re-renders
    wrapper.innerHTML = '';

    // Create the target Adsterra container div
    const containerDiv = document.createElement('div');
    containerDiv.id = 'container-f93109a9ce4a4227b16a6d92e94a8b1f';
    containerDiv.style.minHeight = '60px';
    containerDiv.style.width = '100%';
    containerDiv.style.display = 'flex';
    containerDiv.style.justifyContent = 'center';
    containerDiv.style.alignItems = 'center';
    wrapper.appendChild(containerDiv);

    // Create and append the Adsterra script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://bauval.org/21/f93109a9ce4a4227b16a6d92e94a8b1f';

    wrapper.appendChild(script);

    return () => {
      // Clean up injected elements on unmount
      if (wrapper) {
        wrapper.innerHTML = '';
      }
    };
  }, []);

  return (
    <div 
      className={`w-full flex justify-center items-center select-none ${className}`}
      style={{ margin: '20px auto', display: 'flex', justifyContent: 'center' }}
      data-testid="adsterra-ad-container"
    >
      <div 
        ref={adWrapperRef} 
        className="w-full max-w-[728px] min-h-[60px] flex justify-center items-center overflow-hidden transition-all" 
      />
    </div>
  );
}
