// components/Plot.tsx
import dynamic from 'next/dynamic';

// Dynamically import react-plotly.js with SSR disabled
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default Plot;
