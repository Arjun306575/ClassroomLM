import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
}

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    const renderChart = async () => {
      try {
        if (!chart) return;
        mermaid.initialize({
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
          securityLevel: 'loose',
          startOnLoad: false,
        });
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderResult } = await mermaid.render(id, chart);
        
        // Post-process the SVG to ensure it scales correctly
        const responsiveSvg = renderResult
          .replace(/width="[^"]+"/, 'width="100%"')
          .replace(/height="[^"]+"/, 'height="100%"')
          .replace(/style="[^"]*"/, 'style="max-width:100%; height:auto;"');
          
        setSvg(responsiveSvg);
      } catch (err) {
        console.error('Mermaid render error', err);
        setSvg(`<div class="text-red-500 text-sm p-4 border border-red-500 rounded bg-red-50 dark:bg-red-900/20">Failed to render diagram</div>`);
      }
    };
    renderChart();
  }, [chart]);

  return (
    <div
      ref={containerRef}
      className="my-6 w-full flex justify-center overflow-x-auto overflow-y-hidden"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
