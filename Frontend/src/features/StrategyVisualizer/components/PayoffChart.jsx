// src/features/StrategyVisualizer/components/PayoffChart.jsx
import React, { useRef } from "react";
import { Chart as ChartJS, registerables } from "chart.js";
import { Chart } from "react-chartjs-2"; // Use this for rendering
import annotationPlugin from "chartjs-plugin-annotation";
import { generatePayoffGraphData } from "../../utils/payoffChartUtils";

ChartJS.register(...registerables, annotationPlugin);

const PayoffChart = ({
  strategyLegs,
  niftyTargetString, // Used as fallback if slider is invalid
  displaySpotForSlider, // THIS IS THE PRIMARY CONTROLLER for the chart's center
  targetDateISO,
  riskFreeRate,
  getScenarioIV,
  getOptionByToken,
  targetInterval,
  underlyingSpotPrice, // Actual market spot (can be different from slider)
  showPercentage,
  sdDays,
  fullOptionChainData, // This prop IS A MAP initially
  PAYOFF_GRAPH_POINTS, // Pass these if they are props of PayoffChart
  PAYOFF_GRAPH_INTERVAL_STEP, // Pass these if they are props of PayoffChart
  multiplier = 1, // Default to 1 if not provided
}) => {
  const chartRef = useRef(null);

  let optionChainArray = [];
  if (fullOptionChainData instanceof Map) {
    optionChainArray = Array.from(fullOptionChainData.values());
  } else if (Array.isArray(fullOptionChainData)) {
    optionChainArray = fullOptionChainData;
    if (optionChainArray.length > 0) {
      const firstElement = optionChainArray[0];
      if (
        Array.isArray(firstElement) &&
        firstElement.length === 2 &&
        firstElement[1] &&
        typeof firstElement[1] === "object" &&
        "strike" in firstElement[1]
      ) {
        optionChainArray = optionChainArray.map((entry) => entry[1]);
      } else if (
        !(
          typeof firstElement === "object" &&
          firstElement !== null &&
          "strike" in firstElement
        )
      ) {
        console.warn(
          "PayoffChart: fullOptionChainData is an array, but elements don't look like option objects."
        );
        optionChainArray = []; // Clear if format is wrong
      }
    }
  } else if (fullOptionChainData) {
    console.warn(
      "PayoffChart: fullOptionChainData received is neither a Map nor an Array. OI data will be missing.",
      typeof fullOptionChainData
    );
  }

  const { points, sdBands } = generatePayoffGraphData({
    strategyLegs,
    niftyTargetString,
    displaySpotForSlider, // This drives the center of calculations
    targetDateISO,
    riskFreeRate,
    getScenarioIV,
    getOptionByToken,
    targetInterval,
    PAYOFF_GRAPH_POINTS,
    PAYOFF_GRAPH_INTERVAL_STEP,
    underlyingSpotPrice, // Pass the actual market spot if needed for specific P&L % base elsewhere
    showPercentage,
    sdDays,
    fullOptionChainData: optionChainArray,
  });

  if (!points || points.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", minHeight: 350 }}>
        No data to display. Check inputs or console.
      </div>
    );
  }

  // For linear axis, labels are the numerical x-values
  const chartLabels = points.map((pt) => pt.spot);

  // Data for datasets should be an array of y-values corresponding to chartLabels
  const expiryData = points.map((pt) =>
    showPercentage ? pt.pnlAtExpiryPct : pt.pnlAtExpiry
  );
  const targetData = points.map((pt) =>
    showPercentage ? pt.pnlAtTargetDatePct : pt.pnlAtTargetDate
  );
  const callOIData = points.map((pt) => pt.callOI || 0); // Ensure 0 if undefined
  const putOIData = points.map((pt) => pt.putOI || 0); // Ensure 0 if undefined
  console.log(callOIData, putOIData);
  const hasOIData =
    callOIData.some((oi) => oi > 0) || putOIData.some((oi) => oi > 0);

  const datasets = [];
  if (hasOIData) {
    datasets.push(
      {
        type: "bar",
        label: "Call OI",
        data: points.map((p) => ({ x: p.spot, y: p.callOI || 0 })), // Use {x,y} for linear axis bars
        backgroundColor: "rgba(255, 99, 132, 0.6)", // Reddish for Call
        borderColor: "rgb(255, 86, 123)",
        borderWidth: 5,
        yAxisID: "yOI",
        order: 2,
        barPercentage: 0.4,
        categoryPercentage: 0.9, // Adjust for grouped appearance
      },
      {
        type: "bar",
        label: "Put OI",
        data: points.map((p) => ({ x: p.spot, y: p.putOI || 0 })), // Use {x,y} for linear axis bars
        backgroundColor: "rgba(75, 192, 192, 0.6)", // Greenish for Put
        borderColor: "rgb(52, 255, 62)",
        borderWidth: 5,
        yAxisID: "yOI",
        order: 2,
        barPercentage: 0.4,
        categoryPercentage: 0.9, // Adjust for grouped appearance
      }
    );
  }

  datasets.push(
    {
      type: "line",
      label: "P&L at Expiry",
      data: points.map((p) => ({
        x: p.spot,
        y: showPercentage ? p.pnlAtExpiryPct*multiplier : p.pnlAtExpiry*multiplier,
      })), // Use {x,y}
      borderColor: "#43a047",
      borderWidth: 2,
      pointRadius: 0,
      fill: false,
      tension: 0.1,
      segment: {
        borderColor: (ctx) => (ctx.p1.raw.y >= 0 ? "#43a047" : "#d32f2f"),
      },
      yAxisID: "yPnL",
      order: 1,
    },
    {
      type: "line",
      label: "P&L at Target Date",
      data: points.map((p) => ({
        x: p.spot,
        y: showPercentage ? p.pnlAtTargetDatePct*multiplier : p.pnlAtTargetDate*multiplier,
      })), // Use {x,y}
      borderColor: "rgb(58, 84, 255)", // Red for Target Date P&L
      borderWidth: 2,
      borderDash: [6, 3],
      pointRadius: 0,
      fill: false,
      tension: 0.1,
      segment: {
        borderColor: (ctx) => (ctx.p1.raw.y >= 0 ? "#1976d2" : "#d32f2f"),
      },
      yAxisID: "yPnL",
      order: 1,
    }
  );

  const chartData = {
    // For linear x-axis, labels are not strictly needed if data is {x,y} objects
    // However, Chart.js might still use them for tooltips if not customized
    // labels: chartLabels,
    datasets,
  };

  // sdBands.center is the spot value from slider/target around which bands were calculated
  const centerForSpotAnnotation = sdBands
    ? sdBands.center
    : parseFloat(displaySpotForSlider) ||
      parseFloat(niftyTargetString) ||
      underlyingSpotPrice ||
      0;

  // Find P&L at the centerForSpotAnnotation for the label
  let pnlAtCenterForAnnotation = 0;
  const centerPointData = points.find(
    (p) => Math.abs(p.spot - centerForSpotAnnotation) < 0.001
  );
  if (centerPointData) {
    pnlAtCenterForAnnotation = showPercentage
      ? centerPointData.pnlAtExpiryPct
      : centerPointData.pnlAtExpiry;
  }

  const scalesConfig = {
    x: {
      title: { display: true, text: "Spot / Strike Price" },
      type: "linear", // CRITICAL for annotations at precise values
      min:
        points.length > 0 ? Math.min(...points.map((p) => p.spot)) : undefined,
      max:
        points.length > 0 ? Math.max(...points.map((p) => p.spot)) : undefined,
      ticks: {
        // autoSkip: true, // May not be needed for linear
        // maxTicksLimit: 10 // Adjust for density
        // Consider using a callback for formatting if needed
      },
    },
    yPnL: {
      type: "linear",
      position: "left",
      title: { display: true, text: showPercentage ? "P&L (%)" : "P&L (₹)" },
      grid: { drawOnChartArea: true },
    },
  };
  if (hasOIData) {
    scalesConfig.yOI = {
      type: "linear",
      position: "right",
      title: { display: true, text: "Open Interest" },
      grid: { drawOnChartArea: false },
      ticks: {
        callback: function (value) {
          /* ... K/M formatting ... */
          if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
          if (value >= 1000) return (value / 1000).toFixed(0) + "K";
          return value;
        },
      },
      display: true,
    };
  }

  const annotationsObject = {};
  if (sdBands && typeof sdBands.minus2SD === "number") {
    annotationsObject.minus2SD = {
      type: "line",
      scaleID: "x",
      value: sdBands.minus2SD,
      borderColor: "#ff6b6b",
      borderWidth: 1.5,
      borderDash: [5, 5],
      label: {
        enabled: true,
        content: "-2SD",
        position: "start",
        backgroundColor: "rgba(255,255,255,0.8)",
        color: "#333",
        font: { size: 10 },
        yAdjust: -10,
      },
    };
    annotationsObject.minus1SD = {
      type: "line",
      scaleID: "x",
      value: sdBands.minus1SD,
      borderColor: "#ffa726",
      borderWidth: 1.5,
      borderDash: [5, 5],
      label: {
        enabled: true,
        content: "-1SD",
        position: "start",
        backgroundColor: "rgba(255,255,255,0.8)",
        color: "#333",
        font: { size: 10 },
        yAdjust: -10,
      },
    };
    annotationsObject.plus1SD = {
      type: "line",
      scaleID: "x",
      value: sdBands.plus1SD,
      borderColor: "#ffa726",
      borderWidth: 1.5,
      borderDash: [5, 5],
      label: {
        enabled: true,
        content: "+1SD",
        position: "end",
        backgroundColor: "rgba(255,255,255,0.8)",
        color: "#333",
        font: { size: 10 },
        yAdjust: -10,
      },
    };
    annotationsObject.plus2SD = {
      type: "line",
      scaleID: "x",
      value: sdBands.plus2SD,
      borderColor: "#ff6b6b",
      borderWidth: 1.5,
      borderDash: [5, 5],
      label: {
        enabled: true,
        content: "+2SD",
        position: "end",
        backgroundColor: "rgba(255,255,255,0.8)",
        color: "#333",
        font: { size: 10 },
        yAdjust: -10,
      },
    };
  }
  if (
    typeof centerForSpotAnnotation === "number" &&
    centerForSpotAnnotation > 0
  ) {
    annotationsObject.currentSpotLine = {
      type: "line",
      scaleID: "x",
      value: centerForSpotAnnotation,
      borderColor: "rgba(100,100,100,0.7)",
      borderWidth: 2,
      borderDash: [4, 4],
      label: {
        enabled: true,
        content: `Spot: ${centerForSpotAnnotation.toFixed(0)} | P&L: ${
          pnlAtCenterForAnnotation !== undefined
            ? pnlAtCenterForAnnotation.toFixed(0)
            : "--"
        }`,
        position: "center",
        backgroundColor: "rgba(200,200,200,0.8)",
        color: "black",
        font: { size: 10, weight: "bold" },
        yAdjust: -15,
      },
    };
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom" },
      tooltip: {
        callbacks: {
          title: function (tooltipItems) {
            // For linear axis, tooltipItems[0].parsed.x gives the numerical value
            return `Spot/Strike: ${tooltipItems[0].parsed.x.toFixed(2)}`;
          },
          label: function (context) {
            /* ... same as before ... */
            const datasetLabel = context.dataset.label || "";
            const value = context.parsed.y;
            if (datasetLabel.includes("OI")) {
              return `${datasetLabel}: ${
                value !== null && value !== undefined
                  ? value.toLocaleString()
                  : "N/A"
              }`;
            }
            return `${datasetLabel}: ${
              value !== null && value !== undefined ? value.toFixed(2) : "N/A"
            }`;
          },
        },
      },
      annotation:
        Object.keys(annotationsObject).length > 0
          ? { annotations: annotationsObject }
          : undefined,
    },
    scales: scalesConfig,
    elements: {
      line: { borderWidth: 2, tension: 0.1 },
      point: { radius: 0 },
    },
  };

  return (
    <div style={{ minHeight: 350, maxHeight: 500, width: "100%" }}>
      <Chart type="bar" data={chartData} options={options} />
    </div>
  );
};

export default PayoffChart;
