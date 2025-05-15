"use client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  Brush
} from "recharts";
import React,{useState,useRef} from "react";

export type SellOffRisk = {
  time: string;
  entropy: number;
  plateauRatio: number;
  liquidityRisk: number;
  srs: number;
};
type ZoomReport = {
  totalpage: number;
  currentpage: number;
};
type Props = {
  data: SellOffRisk[];
  showDetails?: boolean;
  title?: string;
  darkMode?: boolean;
  funtype:string;
  onZoomOrPan?: (page: number, funtype:string) => Promise<ZoomReport>;
};

export default function SRSChart({
  data,
  showDetails = true,
  title = "Sell-Off Risk Score (SRS) Over Time",
  darkMode = false,
  funtype,
  onZoomOrPan,
}: Props) {
  //console.log("SRSChart data", data);
  const textColor = darkMode ? "#ddd" : "#333";
  const gridColor = darkMode ? "#555" : "#ccc";
  const [isLoaded, setIsLoaded] = useState(true);
    const [isEnd, setIsEnd] = useState(false);
    const pageRef = useRef(1);
    const totalPage = useRef(0);
    const throttleRef = useRef(false);
  return (
    <div className={`w-full h-[460px] p-4 rounded-lg ${darkMode ? "" : "bg-white"}`}>
      <h3 className={`text-lg font-semibold mb-2 ${darkMode ? "text-white" : "text-gray-800"}`}>
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={data}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
          <XAxis dataKey="time" tick={{ fontSize: 11, fill: textColor }} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: textColor }} />
          <Tooltip
            contentStyle={{
              backgroundColor: darkMode ? "#2d2d2d" : "#fff",
              borderColor: darkMode ? "#444" : "#ccc",
              color: textColor,
            }}
          />
          <Legend verticalAlign="top" height={36} wrapperStyle={{ color: textColor }} />

          
          
            <Line
            type="monotone"
            dataKey="srs"
            name="SRS"
            stroke="#e53935"
            strokeWidth={3}
            dot={false}
            isAnimationActive={false}
          />

              <Line
                type="monotone"
                dataKey="entropy"
                name="Entropy"
                stroke="#1e88e5"
                strokeWidth={2}
                strokeDasharray="6 2"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="plateauRatio"
                name="Plateau Ratio"
                stroke="#43a047"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="liquidityRisk"
                name="Liquidity Risk"
                stroke="#fbc02d"
                strokeWidth={2}
                strokeDasharray="3 1"
                dot={false}
                isAnimationActive={false}
              />
            <Brush
                dataKey="formattedTime"
                height={30}
                stroke={"blue"}
                travellerWidth={10}
                startIndex={pageRef.current >= totalPage.current
                  ? 0
                  :Math.max(0, data.length - (data.length-2))}  // show last 20 points
                endIndex={data.length - 1}
                onChange={async(range) => {
                  pageRef.current =data.length/50
                  if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number' && !isEnd) {
                    
                    const start = data[range.startIndex];
                    const end = data[range.endIndex];
                    //console.log("onZoomOrPan",onZoomOrPan)
                    if (start && end && onZoomOrPan && range.startIndex <2 && isLoaded && !throttleRef.current) {
                      throttleRef.current = true
                      //console.log('Brush range:', range);
                      setIsLoaded(false);
                      
                      const report = await onZoomOrPan(pageRef.current,funtype); // Call external fetch 
                      console.log('Brush range:', report)
                      if (report?.totalpage > 0) {
                        totalPage.current = report.totalpage;
                        if (report.totalpage > pageRef.current) {
                          pageRef.current = report.currentpage+1;
                          console.log('Updated page:', pageRef.current);
                        } else {
                          setIsEnd(true);
                        }
                        
                        setIsLoaded(true); // ✅ use React state setter
                        setTimeout(() => {
                          throttleRef.current = false;
                        }, 1000);
                      }
                      // console.log('Brush range:', report)
                    }
                  }
                }}
              />
          
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
