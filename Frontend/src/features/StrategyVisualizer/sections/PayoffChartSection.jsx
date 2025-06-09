// src/features/StrategyVisualizer/sections/PayoffChartSection.jsx
import React, { useMemo, useCallback, useState } from "react";
import StrategyTabs from "../components/StrategyTabs";
import Button from "../../../components/Button/Button";
import Input from "../../../components/Input/Input";
import Checkbox from "../../../components/Checkbox/Checkbox";
import GreeksTable from "../components/GreeksTable";
import PnLTable from "../components/PnLTable";
import PayoffTable from "../components/PayoffTable";
import { generatePayoffTableData } from "../../utils/payoffTableUtils"; // Utility for P&L Matrix
import Select from "../../../components/Select/Select";
import { usePayoffChartControls } from "../../../hooks/usePayoffChartControls";
import { SPOT_SLIDER_STEP, PAYOFF_TABLE_INTERVAL_STEP } from "../../../config";
import { calculateProjectedStrategyData } from "../../utils/payoffDataCalculator"; // Utility for P&L/Greeks Table
import { NOT_APPLICABLE } from "../../utils/formatters";
import PayoffChart from "../components/PayoffChart"; // The actual chart component
import "./PayoffChartSection.scss";

const SUB_TAB_CHART_VIEW = "subTabChartView";
const SUB_TAB_PAYOFF_TABLE_VIEW = "subTabPayoffTableView";

const PayoffChartSection = ({
  activeChartTab,
  onChartTabChange,
  niftyTarget,
  onNiftyTargetChange,
  onResetNiftyTarget,
  targetDate,
  onTargetDateChange,
  strategyLegs, // Existing (will contain legType)
  getInstrumentByToken, // MODIFIED: Was getOptionByToken
  liveInstrumentChainArray, // MODIFIED: Was liveOptionChainMap, now an array of all instruments
  currentUnderlying,
  riskFreeRate,
  multiplyByLotSize,
  onMultiplyByLotSizeChange,
  multiplyByNumLots,
  onMultiplyByNumLotsChange,
  getScenarioIV, // For options
  underlyingSpotPrice, // Live spot price
  handleSdDaysChange,
  sdDays,
  multiplier = 1,
}) => {
  const [activePayoffGraphSubTab, setActivePayoffGraphSubTab] = useState(
    SUB_TAB_PAYOFF_TABLE_VIEW // Default to showing the P&L Matrix
  );
  const [matrixTableInterval, setMatrixTableInterval] = useState(
    String(PAYOFF_TABLE_INTERVAL_STEP || 50)
  );
  const [showPercentageInMatrix, setShowPercentageInMatrix] = useState(false);

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
    liveInstrumentChainArray, // MODIFIED: Pass the instrument array
    currentUnderlying,
    strategyLegs,
    targetDate,
    onTargetDateChange
  );

  const mainChartTabsDefinition = useMemo(
    () => [
      { id: "payoffgraph", label: "Payoff Graph" },
      { id: "p&ltable", label: "P&L Table" },
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

  const payoffGraphViewSubTabsDefinition = useMemo(
    () => [
      { id: SUB_TAB_CHART_VIEW, label: "Payoff Graph" },
      { id: SUB_TAB_PAYOFF_TABLE_VIEW, label: "Payoff Table" },
    ],
    []
  );

  // Data for "P&L Table" (main tab) and "Greeks" tab
  const singleScenarioPerLegData = useMemo(
    () =>
      calculateProjectedStrategyData({
        strategyLegs,
        niftyTarget,
        targetDate,
        getInstrumentByToken, // MODIFIED: Pass new generic getter
        riskFreeRate,
        getScenarioIV, // For options
        multiplyByLotSize,
        multiplyByNumLots,
      }),
    [
      strategyLegs,
      niftyTarget,
      targetDate,
      getInstrumentByToken, // MODIFIED
      riskFreeRate,
      getScenarioIV,
      multiplyByLotSize,
      multiplyByNumLots,
    ]
  );
 //console.log(singleScenarioPerLegData)
  const payoffMatrixData = useMemo(() => {
    if (!niftyTarget || !targetDate) {
      return [];
    }
    try {
      return generatePayoffTableData({
        strategyLegs,
        niftyTargetString: niftyTarget,
        displaySpotForSlider,
        targetDateISO: targetDate,
        riskFreeRate,
        getScenarioIV, // For options
        getInstrumentByToken, // MODIFIED: Pass new generic getter
        targetInterval: Number(matrixTableInterval),
        underlyingSpotPriceForPercentage: underlyingSpotPrice,
        showPercentage: showPercentageInMatrix,
        // underlyingSpotPrice // This was duplicated, removed
      });
    } catch (error) {
      console.error(
        "[PayoffChartSection] Error in generatePayoffTableData:",
        error
      );
      return [];
    }
  }, [
    strategyLegs,
    niftyTarget,
    displaySpotForSlider,
    targetDate,
    riskFreeRate,
    getScenarioIV,
    getInstrumentByToken, // MODIFIED
    matrixTableInterval,
    underlyingSpotPrice,
    showPercentageInMatrix,
  ]);

  const handleMainTabChangeWithLog = (tabId) => {
    if (activeChartTab === "payoffgraph" && tabId !== "payoffgraph") {
      setActivePayoffGraphSubTab(SUB_TAB_CHART_VIEW);
    }
    onChartTabChange(tabId);
  };

  const handleSubTabChangeWithLog = (tabId) => {
    setActivePayoffGraphSubTab(tabId);
  };

  const handleIncrementSdDays = () => {
    // Renamed for clarity
    if (sdDays < 365) {
      handleSdDaysChange(sdDays + 1);
    }
  };

  const handleDecrementSdDays = () => {
    // Renamed for clarity
    if (sdDays > 0) {
      handleSdDaysChange(sdDays - 1);
    }
  };

  const tableIntervalOptions = useMemo(
    () => [
      { value: "25", label: "25" },
      { value: "50", label: "50" },
      { value: "100", label: "100" },
      { value: "200", label: "200" },
      { value: "250", label: "250" },
      { value: "500", label: "500" },
      { value: "1000", label: "1000" },
      { value: "2000", label: "2000" },
      { value: "3000", label: "3000" },
      { value: "4000", label: "4000" }
    ],
    []
  );

  return (
    <section className="sv-payoff-chart-section">
      <StrategyTabs
        tabs={mainChartTabsDefinition}
        activeTab={activeChartTab}
        onTabChange={handleMainTabChangeWithLog}
        className="chart-section-tabs"
      />
      <div className="tab-content-area">
        {activeChartTab === "payoffgraph" && (
          <div className="payoff-graph-main-tab-content">
            <div className="section-header-controls payoff-sub-tabs-container">
              <StrategyTabs
                tabs={payoffGraphViewSubTabsDefinition}
                activeTab={activePayoffGraphSubTab}
                onTabChange={handleSubTabChangeWithLog}
                className="payoff-sub-tabs"
              />
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
                      onClick={handleDecrementSdDays}
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
                      onChange={(e) => {
                        handleSdDaysChange(Number(e.target.value));
                      }}
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
                      onClick={handleIncrementSdDays}
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

            {activePayoffGraphSubTab === SUB_TAB_CHART_VIEW && (
              <PayoffChart
                strategyLegs={strategyLegs}
                niftyTargetString={niftyTarget} // Fallback if slider invalid
                displaySpotForSlider={displaySpotForSlider} // Primary for chart center
                targetDateISO={targetDate}
                getInstrumentByToken={getInstrumentByToken} // MODIFIED
                riskFreeRate={riskFreeRate}
                getScenarioIV={getScenarioIV} // For options
                underlyingSpotPrice={underlyingSpotPrice} // Actual live spot
                targetInterval={matrixTableInterval} // For chart's internal point generation step
                showPercentage={showPercentageInMatrix} // If chart should show %
                sdDays={sdDays}
                fullInstrumentChainData={liveInstrumentChainArray} // MODIFIED: Pass instrument array
                multiplier={multiplier}
              />
            )}
            {activePayoffGraphSubTab === SUB_TAB_PAYOFF_TABLE_VIEW && (
              <PayoffTable
                payoffData={payoffMatrixData}
                targetDate={targetDate}
                multiplier={multiplier}
              />
            )}
          </div>
        )}

        {activeChartTab === "p&ltable" && (
          <>
            <div className="greeks-controls-header">
              <Checkbox
                label="Lot Size / Contract Multiplier"
                checked={multiplyByLotSize}
                onChange={onMultiplyByLotSizeChange}
              />
              <Checkbox
                label="Num Lots"
                checked={multiplyByNumLots}
                onChange={onMultiplyByNumLotsChange}
              />
            </div>
            <PnLTable
              projectedLegsData={singleScenarioPerLegData.legs}
              totals={singleScenarioPerLegData.totals}
              multiplier={multiplier}
            />
          </>
        )}
        {activeChartTab === "greeks" && (
          <div className="greeks-tab-content">
            <div className="greeks-controls-header">
              <Checkbox
                label="Lot Size / Contract Multiplier"
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
            <GreeksTable
              projectedLegsData={singleScenarioPerLegData.legs}
              totals={singleScenarioPerLegData.totals}
              multiplier={multiplier}
            />
          </div>
        )}
        {activeChartTab === "strategychart" && (
          <div className="tab-content-placeholder">
            <p>Strategy Chart View (To be implemented)</p>
          </div>
        )}
      </div>
      {/* Global Controls ... (existing unchanged) ... */}
      <div className="global-chart-controls">
        <div className="target-controls-row spot-controls">
          <div className="input-slider-group">
            <label htmlFor="spotTargetInput">
              {currentUnderlying || "Spot"} Target
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
              Reset Spot
            </Button>
          </div>
        </div>
        <div className="target-controls-row date-controls">
          <div className="input-slider-group">
            <label htmlFor="dateTargetInput">
              Date: {daysToTargetDisplay}D{" "}
              {daysToTargetDisplay !== "Past" &&
              daysToTargetDisplay !== NOT_APPLICABLE
                ? "to Scenario"
                : ""}
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
              Reset Date
            </Button>
          </div>
        </div>
        <div className="date-slider-labels">
          <span>
            {minDateForSliderRange
              ? new Date(minDateForSliderRange).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "Today"}
          </span>
          <span>
            {maxDateForSliderRange
              ? new Date(maxDateForSliderRange).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                })
              : "Max Exp"}
          </span>
        </div>
      </div>
    </section>
  );
};
export default React.memo(PayoffChartSection);
