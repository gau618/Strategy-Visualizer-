// src/features/StrategyVisualizer/hooks/usePayoffChartControls.js
import { useState, useEffect, useCallback,useMemo } from "react";
import {
  SPOT_SLIDER_RANGE_PERCENT,
  SPOT_SLIDER_STEP,
  MAX_DAYS_FOR_DATE_SLIDER,
} from "../config"; // Adjust path as needed

export const usePayoffChartControls = (
  underlyingSpotPrice,
  liveOptionChainMap,
  currentUnderlying,
  strategyLegs,
  targetDate,
  onTargetDateChange
) => {
  const [displaySpotForSlider, setDisplaySpotForSlider] = useState(0);
  const [spotSliderMin, setSpotSliderMin] = useState(0);
  const [spotSliderMax, setSpotSliderMax] = useState(0);
  const [minDateForSliderRange, setMinDateForSliderRange] = useState("");
  const [maxDateForSliderRange, setMaxDateForSliderRange] = useState("");

  useEffect(() => {
    let spotToUseForRange = 0;
    if (
      underlyingSpotPrice !== null &&
      !isNaN(parseFloat(underlyingSpotPrice))
    ) {
      spotToUseForRange = parseFloat(underlyingSpotPrice);
    } else if (liveOptionChainMap?.size > 0 && currentUnderlying) {
      const anyOption = Array.from(liveOptionChainMap.values()).find(
        (opt) => opt.underlying === currentUnderlying && opt.marketData
      );
      const derivedSpot = parseFloat(
        anyOption?.marketData?.spot ?? anyOption?.marketData?.futures
      );
      if (!isNaN(derivedSpot) && derivedSpot > 0) {
        spotToUseForRange = derivedSpot;
      }
    }

    const fallbackSpot =
      currentUnderlying === "BANKNIFTY"
        ? 48000
        : currentUnderlying === "NIFTY"
        ? 23000
        : 20000;
    if (spotToUseForRange <= 0) spotToUseForRange = fallbackSpot;

    setDisplaySpotForSlider(spotToUseForRange);

    if (spotToUseForRange > 0) {
      setSpotSliderMin(
        Math.max(
          0,
          Math.round(
            (spotToUseForRange * (1 - SPOT_SLIDER_RANGE_PERCENT)) /
              SPOT_SLIDER_STEP
          ) * SPOT_SLIDER_STEP
        )
      );
      setSpotSliderMax(
        Math.round(
          (spotToUseForRange * (1 + SPOT_SLIDER_RANGE_PERCENT)) /
            SPOT_SLIDER_STEP
        ) * SPOT_SLIDER_STEP
      );
    } else {
      setSpotSliderMin(0);
      setSpotSliderMax(
        Math.round((fallbackSpot * 1.5) / SPOT_SLIDER_STEP) *
          SPOT_SLIDER_STEP || 30000
      );
    }

    let latestExpiryDateInStrategy = new Date();
    let foundMaxExpiry = false;
    if (strategyLegs.length > 0 && strategyLegs.some((l) => l.selected)) {
      strategyLegs.forEach((leg) => {
        if (leg.selected && leg.expiry) {
          try {
            const day = parseInt(leg.expiry.substring(0, 2), 10);
            const monthStr = leg.expiry.substring(2, 5).toUpperCase();
            const year = parseInt(leg.expiry.substring(5, 9), 10);
            const months = {
              JAN: 0,
              FEB: 1,
              MAR: 2,
              APR: 3,
              MAY: 4,
              JUN: 5,
              JUL: 6,
              AUG: 7,
              SEP: 8,
              OCT: 9,
              NOV: 10,
              DEC: 11,
            };
            const legExpiryDate = new Date(
              Date.UTC(year, months[monthStr], day, 10, 0, 0)
            );
            if (!isNaN(legExpiryDate.getTime())) {
              if (
                !foundMaxExpiry ||
                legExpiryDate > latestExpiryDateInStrategy
              ) {
                latestExpiryDateInStrategy = legExpiryDate;
                foundMaxExpiry = true;
              }
            }
          } catch (e) {
            console.warn("Hook: Error parsing leg expiry:", leg.expiry, e);
          }
        }
      });
    }
    if (!foundMaxExpiry) {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + MAX_DAYS_FOR_DATE_SLIDER);
      latestExpiryDateInStrategy = futureDate;
    }

    const todayForSliderInternal = new Date();
    const newMinDateISO = todayForSliderInternal.toISOString().slice(0, 16);
    setMinDateForSliderRange(newMinDateISO);

    let maxDateObjInternal = new Date(latestExpiryDateInStrategy);
    if (maxDateObjInternal.getTime() < todayForSliderInternal.getTime()) {
      const futureMax = new Date(todayForSliderInternal);
      futureMax.setDate(futureMax.getDate() + MAX_DAYS_FOR_DATE_SLIDER);
      maxDateObjInternal = futureMax;
    }
    const newMaxDateISO = maxDateObjInternal.toISOString().slice(0, 16);
    setMaxDateForSliderRange(newMaxDateISO);

    if (targetDate && onTargetDateChange) {
      // Ensure onTargetDateChange is provided
      if (targetDate < newMinDateISO) onTargetDateChange(newMinDateISO);
      else if (targetDate > newMaxDateISO) onTargetDateChange(newMaxDateISO);
    }
  }, [
    underlyingSpotPrice,
    liveOptionChainMap,
    currentUnderlying,
    strategyLegs,
    targetDate,
    onTargetDateChange,
  ]);

  const dateSliderValue = useMemo(() => {
    if (!minDateForSliderRange || !maxDateForSliderRange || !targetDate)
      return 0;
    const minEpoch = new Date(minDateForSliderRange).getTime();
    const maxEpoch = new Date(maxDateForSliderRange).getTime();
    const currentTargetEpoch = new Date(targetDate).getTime();
    if (
      isNaN(minEpoch) ||
      isNaN(maxEpoch) ||
      isNaN(currentTargetEpoch) ||
      maxEpoch <= minEpoch
    )
      return 0;
    if (currentTargetEpoch <= minEpoch) return 0;
    if (currentTargetEpoch >= maxEpoch) return 100;
    return Math.round(
      ((currentTargetEpoch - minEpoch) / (maxEpoch - minEpoch)) * 100
    );
  }, [targetDate, minDateForSliderRange, maxDateForSliderRange]);

  const handleDateSliderChange = useCallback(
    (e) => {
      const sliderValue = parseInt(e.target.value, 10);
      if (
        !minDateForSliderRange ||
        !maxDateForSliderRange ||
        !onTargetDateChange
      )
        return;
      const minEpoch = new Date(minDateForSliderRange).getTime();
      const maxEpoch = new Date(maxDateForSliderRange).getTime();
      if (isNaN(minEpoch) || isNaN(maxEpoch) || minEpoch >= maxEpoch) {
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        onTargetDateChange(today.toISOString().slice(0, 16));
        return;
      }
      const newTargetEpoch =
        minEpoch + (maxEpoch - minEpoch) * (sliderValue / 100);
      const newTargetDateObj = new Date(newTargetEpoch);
      newTargetDateObj.setMinutes(
        newTargetDateObj.getMinutes() - newTargetDateObj.getTimezoneOffset()
      );
      onTargetDateChange(newTargetDateObj.toISOString().slice(0, 16));
    },
    [minDateForSliderRange, maxDateForSliderRange, onTargetDateChange]
  );

  const handleResetDate = useCallback(() => {
    if (!onTargetDateChange) return;
    if (minDateForSliderRange) onTargetDateChange(minDateForSliderRange);
    else {
      const today = new Date();
      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
      onTargetDateChange(today.toISOString().slice(0, 16));
    }
  }, [onTargetDateChange, minDateForSliderRange]);

  const daysToTargetDisplay = useMemo(() => {
    if (!targetDate) return "N/A";
    const targetD = new Date(targetDate);
    const todayD = new Date();
    targetD.setHours(0, 0, 0, 0);
    todayD.setHours(0, 0, 0, 0);
    const diffTime = targetD.getTime() - todayD.getTime();
    if (diffTime < 0 && Math.abs(diffTime) < 1000 * 60 * 60 * 12) return "0";
    if (diffTime < 0) return "Past";
    return String(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }, [targetDate]);

  return {
    displaySpotForSlider,
    spotSliderMin,
    spotSliderMax,
    minDateForSliderRange,
    maxDateForSliderRange,
    dateSliderValue,
    handleDateSliderChange,
    handleResetDate,
    daysToTargetDisplay,
  };
};
