import React, { useEffect, useRef, useState } from 'react';

interface AdsterraAdProps {
  className?: string;
}

/**
 * Adsterra native banner placement component
 * Safely loads external script in an isolated iframe sandbox to ensure
 * reliable execution on all views (including Homepage and Generating Lesson page).
 * Automatically calculates dynamic content height from deepest rendered ad elements
 * to ensure all 4 ads are fully visible with no excessive empty space and no scroll lag.
 */
export function AdsterraAd({ className = '' }: AdsterraAdProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Default height initialized cleanly; dynamically adjusts to the exact height of all ads
  const [iframeHeight, setIframeHeight] = useState<number>(240);
  const currentHeightRef = useRef<number>(240);

  // Update height to fit all 4 native ads without compounding whitespace
  const updateHeight = (reported: number) => {
    if (typeof reported !== 'number' || isNaN(reported) || reported <= 30) return;
    // Tight 8px buffer ensures shadows and borders are visible without leaving empty gaps
    const clamped = Math.max(80, Math.min(2600, Math.round(reported + 8)));
    const prev = currentHeightRef.current;
    
    // Only adjust if difference is meaningful (>= 15px) to prevent scroll jitter/lag
    if (Math.abs(clamped - prev) >= 15) {
      currentHeightRef.current = clamped;
      setIframeHeight(clamped);
    }
  };

  useEffect(() => {
    // Listen for resize messages sent from the iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'ADSTERRA_RESIZE' && typeof event.data.height === 'number') {
        updateHeight(event.data.height);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;

      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body {
                width: 100%;
                height: auto;
                background: transparent;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                overflow: visible;
                font-family: system-ui, -apple-system, sans-serif;
                touch-action: pan-y;
                padding-bottom: 4px;
              }
              #container-f93109a9ce4a4227b16a6d92e94a8b1f {
                width: 100%;
                min-height: 50px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-start;
                overflow: visible;
                touch-action: pan-y;
                padding-bottom: 2px;
              }
              #container-f93109a9ce4a4227b16a6d92e94a8b1f img {
                max-width: 100%;
                height: auto;
                display: block;
              }
            </style>
          </head>
          <body>
            <div id="container-f93109a9ce4a4227b16a6d92e94a8b1f"></div>
            <script type="text/javascript">
              function getDeepestBottom() {
                var c = document.getElementById('container-f93109a9ce4a4227b16a6d92e94a8b1f');
                if (!c) return 0;
                var all = c.querySelectorAll('*');
                var maxBottom = 0;
                for (var i = 0; i < all.length; i++) {
                  var el = all[i];
                  if (el.offsetHeight > 0 || el.offsetWidth > 0) {
                    var rect = el.getBoundingClientRect();
                    if (rect && rect.bottom > maxBottom) {
                      maxBottom = rect.bottom;
                    }
                  }
                }
                return maxBottom;
              }

              function measureAndReport() {
                var c = document.getElementById('container-f93109a9ce4a4227b16a6d92e94a8b1f');
                if (!c) return;

                // Measure strictly by deepest rendered content element inside container
                // to avoid compounding scrollHeight inflation and empty bottom space
                var deepest = getDeepestBottom();
                var h = deepest > 40 ? deepest : (c.offsetHeight || 0);

                if (h > 40) {
                  try {
                    window.parent.postMessage({ type: 'ADSTERRA_RESIZE', height: Math.ceil(h) }, '*');
                  } catch (e) {}
                }
              }

              function attachImgListeners() {
                var c = document.getElementById('container-f93109a9ce4a4227b16a6d92e94a8b1f') || document.body;
                if (!c) return;
                var imgs = c.getElementsByTagName('img');
                for (var i = 0; i < imgs.length; i++) {
                  if (!imgs[i].hasAttribute('data-measured')) {
                    imgs[i].setAttribute('data-measured', 'true');
                    imgs[i].addEventListener('load', measureAndReport);
                    imgs[i].addEventListener('error', measureAndReport);
                  }
                }
              }

              // Observe container mutations so newly injected ads trigger immediate height measurement
              var cElem = document.getElementById('container-f93109a9ce4a4227b16a6d92e94a8b1f');
              if (cElem && window.MutationObserver) {
                var mo = new MutationObserver(function() {
                  attachImgListeners();
                  measureAndReport();
                });
                mo.observe(cElem, { childList: true, subtree: true, attributes: true });
              }

              window.addEventListener('load', function() {
                attachImgListeners();
                measureAndReport();
              });
              window.addEventListener('resize', measureAndReport);

              // Periodic staged measurements to cover dynamic ad delivery and font rendering
              setTimeout(measureAndReport, 250);
              setTimeout(measureAndReport, 600);
              setTimeout(measureAndReport, 1200);
              setTimeout(measureAndReport, 2200);
              setTimeout(measureAndReport, 3600);
              setTimeout(measureAndReport, 5500);
              setTimeout(measureAndReport, 8000);
            </script>
            <script type="text/javascript" data-cfasync="false" async src="https://bauval.org/21/f93109a9ce4a4227b16a6d92e94a8b1f"></script>
          </body>
        </html>
      `);
      doc.close();
    } catch (e) {
      console.warn("Could not write to Adsterra iframe:", e);
    }
  }, []);

  // Staged parent check as fallback (no continuous interval loop)
  useEffect(() => {
    const checkDomHeight = () => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          const container = doc.getElementById('container-f93109a9ce4a4227b16a6d92e94a8b1f');
          if (!container) return;
          let maxBottom = 0;
          const all = container.querySelectorAll('*');
          for (let i = 0; i < all.length; i++) {
            const el = all[i] as HTMLElement;
            if (el.offsetHeight > 0 || el.offsetWidth > 0) {
              const rect = el.getBoundingClientRect();
              if (rect.bottom > maxBottom) maxBottom = rect.bottom;
            }
          }
          const h = maxBottom > 40 ? maxBottom : (container.offsetHeight || 0);
          if (h > 40) {
            updateHeight(h);
          }
        }
      } catch (e) {}
    };

    const t1 = setTimeout(checkDomHeight, 600);
    const t2 = setTimeout(checkDomHeight, 1500);
    const t3 = setTimeout(checkDomHeight, 3000);
    const t4 = setTimeout(checkDomHeight, 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div 
      className={`w-full flex flex-col justify-center items-center select-none ${className}`}
      style={{ 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        touchAction: 'pan-y'
      }}
      data-testid="adsterra-ad-container"
    >
      <div className="flex items-center gap-1 mb-1 text-[10px] sm:text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-200 select-none drop-shadow-sm">
        <span>Sponsored</span>
      </div>
      <div 
        className="w-full max-w-[760px] flex justify-center items-center overflow-visible rounded-xl"
        style={{ touchAction: 'pan-y' }}
      >
        <iframe
          ref={iframeRef}
          title="Sponsored Educational Partner"
          style={{ 
            height: `${iframeHeight}px`, 
            minHeight: '80px',
            touchAction: 'pan-y'
          }}
          className="w-full border-0 bg-transparent overflow-visible"
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
