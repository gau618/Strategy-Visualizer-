// src/features/StrategyVisualizer/sections/PayoffChartSection.jsx
// Based on your paste.txt, with Payoff Table (P&L Matrix) sub-tab implemented.
import React, {
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useState, // Added for sub-tab state and table controls
} from "react";
import StrategyTabs from "../components/StrategyTabs";
import Button from "../../../components/Button/Button";
import Input from "../../../components/Input/Input";
import Checkbox from "../../../components/Checkbox/Checkbox";
import GreeksTable from "../components/GreeksTable";
import PnLTable from "../components/PnLTable"; // Your original P&L Table component
import { Chart, registerables } from "chart.js"; // As in your file

// --- Imports for the NEW Payoff Table (P&L Matrix) Sub-Tab ---
import PayoffTable from "../components/PayoffTable"; // You need to create/have this component
import { generatePayoffTableData } from "../../utils/payoffTableUtils"; // Utility to generate matrix data
import Select from "../../../components/Select/Select"; // For interval dropdown

// --- Your existing imports ---
import { usePayoffChartControls } from "../../../hooks/usePayoffChartControls";
import { SPOT_SLIDER_STEP, PAYOFF_TABLE_INTERVAL_STEP } from "../../../config";
import { calculateProjectedStrategyData } from "../../utils/payoffDataCalculator";
import { NOT_APPLICABLE } from "../../utils/formatters"; // Assuming this is used by PayoffTable or PnLTable
import PayoffChart from "../components/PayoffChart";
import "./PayoffChartSection.scss";

// IDs for the sub-tabs within "Payoff Graph" main tab
const SUB_TAB_CHART_VIEW = "subTabChartView"; // For the (potentially blank) chart
const SUB_TAB_PAYOFF_TABLE_VIEW = "subTabPayoffTableView"; // For the P&L Matrix

const PayoffChartSection = ({
  activeChartTab, // Main tab ID
  onChartTabChange,
  niftyTarget,
  onNiftyTargetChange,
  onResetNiftyTarget,
  targetDate,
  onTargetDateChange,
  strategyLegs,
  getOptionByToken,
  liveOptionChainMap,
  currentUnderlying,
  riskFreeRate,
  multiplyByLotSize,
  onMultiplyByLotSizeChange,
  multiplyByNumLots,
  onMultiplyByNumLotsChange,
  getScenarioIV,
  underlyingSpotPrice,
  handleSdDaysChange,
  sdDays,
  multiplier = 1, // Assuming multiplier is passed for scaling
}) => {
  const [activePayoffGraphSubTab, setActivePayoffGraphSubTab] = useState(
    SUB_TAB_PAYOFF_TABLE_VIEW
  ); // Default to Payoff Table view for this test

  // State for Payoff Table (P&L Matrix) controls
  const [matrixTableInterval, setMatrixTableInterval] = useState(
    String(PAYOFF_TABLE_INTERVAL_STEP || 50)
  );
  const [showPercentageInMatrix, setShowPercentageInMatrix] = useState(false); // Optional

  const {
    displaySpotForSlider,
    spotSliderMin,
    spotSliderMax,
    minDateForSliderRange,
    maxDateForSliderRange,
    dateSliderValue,
    handleDateSliderChange,
    handleResetDate,
    daysToTargetDisplay,
  } = usePayoffChartControls(
    underlyingSpotPrice,
    liveOptionChainMap,
    currentUnderlying,
    strategyLegs,
    targetDate,
    onTargetDateChange
  );

  // Your original main tabs d efinition from paste.txt
  const mainChartTabsDefinition = useMemo(
    () => [
      { id: "payoffgraph", label: "Payoff Graph" }, // This will host sub-tabs
      { id: "p&ltable", label: "P&L Table" }, // Your original P&L tab
      { id: "greeks", label: "Greeks" },
      { id: "strategychart", label: "Strategy Chart" },
    ],
    []
  );
    const niftyTargetInputValue =
    niftyTarget !== "" && !isNaN(parseFloat(niftyTarget))
      ? parseFloat(niftyTarget).toFixed(2)
      : "";
  const niftyTargetSliderValue =
    niftyTarget !== "" && !isNaN(parseFloat(niftyTarget))
      ? parseFloat(niftyTarget)
      : displaySpotForSlider > 0
      ? displaySpotForSlider
      : spotSliderMin;

  // Definition for the sub-tabs within "Payoff Graph"
  const payoffGraphViewSubTabsDefinition = useMemo(
    () => [
      { id: SUB_TAB_CHART_VIEW, label: "Payoff Graph" }, // For the chart
      { id: SUB_TAB_PAYOFF_TABLE_VIEW, label: "Payoff Table" }, // For P&L Matrix
    ],
    []
  );

  // Data for your original "P&L Table" (main tab) and "Greeks" tab (UNCHANGED)
  const singleScenarioPerLegData = useMemo(
    () =>
      calculateProjectedStrategyData({
        // Your original function
        strategyLegs,
        niftyTarget,
        targetDate,
        getOptionByToken,
        riskFreeRate,
        getScenarioIV,
        multiplyByLotSize,
        multiplyByNumLots,
      }),
    [
      strategyLegs,
      niftyTarget,
      targetDate,
      getOptionByToken,
      riskFreeRate,
      getScenarioIV,
      multiplyByLotSize,
      multiplyByNumLots,
    ]
  );
  // Data for the NEW "Payoff Table" (P&L Matrix) sub-tab
  const payoffMatrixData = useMemo(() => {
    // console.log(
    //   "[PayoffChartSection] HOOK: Recalculating payoffMatrixData for Payoff Table sub-tab. Interval:",
    //   matrixTableInterval
    // );
    // Ensure generatePayoffTableData can handle potentially empty/invalid niftyTarget or targetDate gracefully
    if (!niftyTarget || !targetDate) {
      // console.warn(
      //   "[PayoffChartSection] generatePayoffTableData skipped: niftyTarget or targetDate is missing."
      // );
      return []; // Return empty if critical inputs missing
    }
    try {
      return generatePayoffTableData({
        strategyLegs,
        niftyTargetString: niftyTarget, // generatePayoffTableData expects string
        displaySpotForSlider,
        targetDateISO: targetDate, // generatePayoffTableData expects ISO string
        riskFreeRate,
        getScenarioIV,
        getOptionByToken,
        targetInterval: Number(matrixTableInterval),
        underlyingSpotPriceForPercentage: underlyingSpotPrice,
        showPercentage: showPercentageInMatrix,
        underlyingSpotPrice
      });
    } catch (error) {
      console.error(
        "[PayoffChartSection] Error in generatePayoffTableData:",
        error
      );
      return []; // Return empty array on error
    }
  }, [
    strategyLegs,
    niftyTarget,
    displaySpotForSlider,
    targetDate,
    riskFreeRate,
    getScenarioIV,
    getOptionByToken,
    matrixTableInterval,
    underlyingSpotPrice,
    showPercentageInMatrix,
  ]);
  //  console.log(payoffMatrixData);


  const handleMainTabChangeWithLog = (tabId) => {
    // console.log("[PayoffChartSection] Main tab changed to:", tabId);
    if (activeChartTab === "payoffgraph" && tabId !== "payoffgraph") {
      setActivePayoffGraphSubTab(SUB_TAB_CHART_VIEW); // Reset sub-tab to chart when leaving main graph tab
    }
    onChartTabChange(tabId);
  };

  const handleSubTabChangeWithLog = (tabId) => {
    //console.log("[PayoffChartSection] Payoff Graph Sub-tab changed to:", tabId);
    setActivePayoffGraphSubTab(tabId);
  };

const handleIncrement = () => {
  if (sdDays < 365) {
    handleSdDaysChange(sdDays + 1);
  }
};

const handleDecrement = () => {
  if (sdDays > 0) {
    handleSdDaysChange(sdDays - 1);
  }
};

  const resetChartZoom = useCallback(() => {
    /* Your original reset logic if any */
  }, []); // Assuming you might add this later

  const tableIntervalOptions = useMemo(
    () => [
      { value: "25", label: "25" },
      { value: "50", label: "50" },
      { value: "100", label: "100" },
      { value: "200", label: "200" },
      { value: "250", label: "250" },
      { value: "500", label: "500" },
      { value: "1000", label: "1000" },
    ],
    []
  );

  return (
    <section className="sv-payoff-chart-section">
      {/* Main Tabs (Your original implementation) */}
      <StrategyTabs
        tabs={mainChartTabsDefinition} // Using mainChartTabsDefinition as per your paste.txt
        activeTab={activeChartTab}
        onTabChange={handleMainTabChangeWithLog}
        className="chart-section-tabs" // Your class name
      />

      <div className="tab-content-area">
        {/* Content for "Payoff Graph" MAIN Tab */}
        {activeChartTab === "payoffgraph" && (
          <div className="payoff-graph-main-tab-content">
            {/* Sub-Tabs for "Payoff Graph" and "Payoff Table" (P&L Matrix) */}
            <div className="section-header-controls payoff-sub-tabs-container">
              <StrategyTabs
                tabs={payoffGraphViewSubTabsDefinition} // Using payoffGraphViewSubTabsDefinition
                activeTab={activePayoffGraphSubTab}
                onTabChange={handleSubTabChangeWithLog}
                className="payoff-sub-tabs"
              />
              {/* Controls specifically for the "Payoff Table" (P&L Matrix) SUB-TAB */}
              {activePayoffGraphSubTab === SUB_TAB_PAYOFF_TABLE_VIEW && (
                <div className="table-controls payoff-matrix-table-controls">
                  <label htmlFor="matrixTableIntervalSelect">
                    Target Interval:
                  </label>
                  <Select
                    id="matrixTableIntervalSelect"
                    options={tableIntervalOptions}
                    value={matrixTableInterval}
                    onChange={(val) => setMatrixTableInterval(val)}
                    className="table-interval-select"
                  />
                  <Checkbox
                    label="Show % P&L"
                    checked={showPercentageInMatrix}
                    onChange={(checked) =>
                      setShowPercentageInMatrix(Boolean(checked))
                    }
                    className="show-percentage-checkbox"
                  />
                </div>
              )}
              {/* Placeholder for Chart-specific controls if "Payoff Graph" SUB-TAB is active */}
              {activePayoffGraphSubTab === SUB_TAB_CHART_VIEW && (
                <div className="chart-specific-controls">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      overflow: "hidden",
                      width: "fit-content",
                    }}
                  >
                    <button
                      onClick={handleDecrement}
                      style={{
                        border: "none",
                        background: "#f8f9fa",
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: "16px",
                        color: "#666",
                      }}
                    >
                      −
                    </button>

                    <input
                      type="number"
                      value={sdDays}
                      onChange={(e)=>{handleSdDaysChange(Number(e.target.value))}}
                      style={{
                        border: "none",
                        padding: "8px 16px",
                        textAlign: "center",
                        fontSize: "14px",
                        minWidth: "80px",
                        outline: "none",
                        background: "white",
                      }}
                    />

                    <button
                      onClick={handleIncrement}
                      style={{
                        border: "none",
                        background: "#f8f9fa",
                        padding: "8px 12px",
                        cursor: "pointer",
                        fontSize: "16px",
                        color: "#666",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Content for "Payoff Graph" SUB-TAB (Your original chart canvas) */}
            {activePayoffGraphSubTab === SUB_TAB_CHART_VIEW && (
              <>
                <PayoffChart
                  strategyLegs={strategyLegs}
                  niftyTargetString={niftyTarget}
                  targetDateISO={targetDate}
                  getOptionByToken={getOptionByToken}
                  riskFreeRate={riskFreeRate}
                  getScenarioIV={getScenarioIV}
                  underlyingSpotPrice={underlyingSpotPrice}
                  targetInterval={matrixTableInterval} // Assuming this is the interval for the chart
                  displaySpotForSlider={displaySpotForSlider}
                  showPercentage={showPercentageInMatrix} // Pass this prop if needed
                  sdDays={sdDays} // Pass sdDays for SD bands
                  fullOptionChainData={liveOptionChainMap}
                  multiplier={multiplier} // Pass multiplier prop if needed
                ></PayoffChart>
              </>
            )}

            {/* Content for "Payoff Table" (P&L Matrix) SUB-TAB */}
            {activePayoffGraphSubTab === SUB_TAB_PAYOFF_TABLE_VIEW && (
              <PayoffTable // This component renders the P&L Matrix
                payoffData={payoffMatrixData} // Data from generatePayoffTableData
                targetDate={targetDate} // For table headers
                // Pass any other props your PayoffTable component might need:
                // underlyingSpotPrice={underlyingSpotPrice}
                // showPercentage={showPercentageInMatrix}
                multiplier={multiplier} // Pass multiplier prop if needed
              />
            )}
          </div>
        )}

        {/* Content for YOUR ORIGINAL "P&L Table" MAIN Tab */}
        {activeChartTab === "p&ltable" && (
          <>
            {" "}
            {/* Using Fragment as in your original paste.txt structure */}
            <div className="greeks-controls-header">
              {" "}
              {/* Your original class */}
              <Checkbox
                label="Lot Size"
                checked={multiplyByLotSize}
                onChange={onMultiplyByLotSizeChange}
              />
              <Checkbox
                label="Num Lots"
                checked={multiplyByNumLots}
                onChange={onMultiplyByNumLotsChange}
              />
            </div>
            <PnLTable // Your original component
              projectedLegsData={singleScenarioPerLegData.legs} // Using your original data variable
              totals={singleScenarioPerLegData.totals}
              multiplier={multiplier} // Pass multiplier prop if needed
            />
          </>
        )}

        {/* Content for YOUR ORIGINAL "Greeks" MAIN Tab */}
        {activeChartTab === "greeks" && (
          <div className="greeks-tab-content">
            {" "}
            {/* Your original class */}
            <div className="greeks-controls-header">
              {" "}
              {/* Your original class */}
              <Checkbox
                label="Lot Size"
                checked={multiplyByLotSize}
                onChange={onMultiplyByLotSizeChange}
                className="greeks-multiplier-checkbox"
              />
              <Checkbox
                label="Num Lots"
                checked={multiplyByNumLots}
                onChange={onMultiplyByNumLotsChange}
                className="greeks-multiplier-checkbox"
              />
            </div>
            <GreeksTable // Your original component
              projectedLegsData={singleScenarioPerLegData.legs} // Using your original data variable
              totals={singleScenarioPerLegData.totals}
              multiplier={multiplier} // Pass multiplier prop if needed
            />
          </div>
        )}

        {/* Content for YOUR ORIGINAL "Strategy Chart" MAIN Tab */}
        {activeChartTab === "strategychart" && (
          <div className="tab-content-placeholder">
            {" "}
            {/* Your original class */}
            <p>Strategy Chart View (To be implemented)</p>
          </div>
        )}
      </div>

      {/* Global Controls (Your original JSX from paste.txt) */}
      <div className="global-chart-controls">
        <div className="target-controls-row spot-controls">
          <div className="input-slider-group">
            <label htmlFor="spotTargetInput">
              {" "}
              {currentUnderlying || "Spot"} Target{" "}
            </label>
            <div className="input-with-buttons">
              <Button
                variant="icon"
                size="small"
                icon="-"
                onClick={() => {
                  const cv = parseFloat(
                    niftyTarget || displaySpotForSlider || 0
                  );
                  onNiftyTargetChange(
                    (cv - (SPOT_SLIDER_STEP || 50)).toFixed(2)
                  );
                }}
              />
              <Input
                id="spotTargetInput"
                type="number"
                value={niftyTargetInputValue}
                onChange={(value) => onNiftyTargetChange(value)}
                className="target-value-input"
                placeholder={
                  displaySpotForSlider > 0
                    ? displaySpotForSlider.toFixed(2)
                    : "Target"
                }
              />
              <Button
                variant="icon"
                size="small"
                icon="+"
                onClick={() => {
                  const cv = parseFloat(
                    niftyTarget || displaySpotForSlider || 0
                  );
                  onNiftyTargetChange(
                    (cv + (SPOT_SLIDER_STEP || 50)).toFixed(2)
                  );
                }}
              />
            </div>
            <input
              type="range"
              min={spotSliderMin}
              max={spotSliderMax}
              value={niftyTargetSliderValue}
              step={SPOT_SLIDER_STEP || 50}
              onChange={(e) => onNiftyTargetChange(e.target.value)}
              className="global-target-slider spot-slider"
            />
            <Button variant="link" size="small" onClick={onResetNiftyTarget}>
              {" "}
              Reset Spot{" "}
            </Button>
          </div>
        </div>
        <div className="target-controls-row date-controls">
          <div className="input-slider-group">
            <label htmlFor="dateTargetInput">
              {" "}
              Date: {daysToTargetDisplay}D{" "}
              {daysToTargetDisplay !== "Past" &&
              daysToTargetDisplay !== NOT_APPLICABLE
                ? "to Scenario"
                : ""}{" "}
            </label>
            <div className="input-with-buttons date-input-actual-wrapper">
              <Input
                id="dateTargetDisplay"
                type="text"
                value={
                  targetDate
                    ? new Date(targetDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : ""
                }
                readOnly
                className="target-value-input date-display-input"
                onClick={() =>
                  document
                    .getElementById("hiddenDateTargetInput")
                    ?.showPicker?.()
                }
              />
              <Input
                id="hiddenDateTargetInput"
                type="datetime-local"
                value={targetDate}
                onChange={(val) => onTargetDateChange(val)}
                className="hidden-date-input"
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={dateSliderValue}
              onChange={handleDateSliderChange}
              className="global-target-slider date-slider"
              disabled={
                !minDateForSliderRange ||
                !maxDateForSliderRange ||
                minDateForSliderRange >= maxDateForSliderRange
              }
            />
            <Button variant="link" size="small" onClick={handleResetDate}>
              {" "}
              Reset Date{" "}
            </Button>
          </div>
        </div>
        <div className="date-slider-labels">
          <span>
            {" "}
            {minDateForSliderRange
              ? new Date(minDateForSliderRange).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "Today"}{" "}
          </span>
          <span>
            {" "}
            {maxDateForSliderRange
              ? new Date(maxDateForSliderRange).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "Max Exp"}{" "}
          </span>
        </div>
      </div>
    </section>
  );
};
export default React.memo(PayoffChartSection);
