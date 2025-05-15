import React,{useState,useRef} from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,Brush } from "recharts";
type ZoomReport = {
    totalpage: number;
    currentpage: number;
  };
interface LineGraphProps {
    data: { name: string; value: number }[];
    color?: string;
    funtype:string;
    onZoomOrPan?: (page: number, funtype:string) => Promise<ZoomReport>;
}
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: "#fff",
                padding: "1px 1px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "10px",
                color: "black",

            }}>
                <p>{`Time: ${payload[0].payload.name}`}</p>
                <p>{`Value: ${payload[0].value}`}</p>
            </div>
        );
    }
    return null;
};
const LineGraph: React.FC<LineGraphProps> = ({ data, color = "#10B981",funtype,onZoomOrPan }) => {
    const [isLoaded, setIsLoaded] = useState(true);
        const [isEnd, setIsEnd] = useState(false);
        const pageRef = useRef(1);
        const totalPage = useRef(0);
        const throttleRef = useRef(false);
        data.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
    return (
        <ResponsiveContainer width="100%" height={64}>
            <LineChart data={data}>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
                <Brush
                    dataKey="formattedTime"
                    height={3}
                    stroke={"blue"}
                    travellerWidth={10}
                    startIndex={pageRef.current === totalPage.current
                        ? 0
                        :Math.max(0, data.length - (data.length-5))}  // show last 20 points
                    endIndex={data.length - 1}
                    onChange={async(range) => {
                    
                    if (range && typeof range.startIndex === 'number' && typeof range.endIndex === 'number' && !isEnd) {
                        
                        const start = data[range.startIndex];
                        const end = data[range.endIndex];
                        //console.log("onZoomOrPan",onZoomOrPan)
                        if (start && end && onZoomOrPan && range.startIndex <2 && isLoaded && !throttleRef.current) {
                        throttleRef.current = true;
                        setIsLoaded(false);
                        
                        const report = await onZoomOrPan(pageRef.current,funtype); // Call external fetch 
                        console.log('Brush range:', report,report.totalpage > 0)
                        if (report.totalpage > 0) {
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
    );
};

export default LineGraph;
