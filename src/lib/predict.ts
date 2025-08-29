export function basePredict(car: any, mods: any[]) {
  const notes: string[] = [];
  
  // Use updated column names with fallbacks
  let hp = car.stock_hp_bhp || 0;
  let tq = car.stock_tq_lbft || 0; 
  let weight = car.curb_weight_lb || estimateWeightByVehicle(car);

  // If we have no base power data, try to estimate
  if (hp === 0) {
    hp = estimateHpByVehicle(car);
    notes.push('Base horsepower estimated - submit actual specs for better accuracy.');
  }
  
  if (tq === 0) {
    tq = Math.round(hp * 0.85); // Rough torque estimate from HP
    notes.push('Base torque estimated from horsepower.');
  }

  let gainFactor = 0.9; // diminishing returns after first power mod
  let addedPowerMods = 0;

  // Apply modifications
  for (const m of mods) {
    weight += m.avg_weight_delta_lbs || 0;
    const hpGain = m.avg_hp_gain || 0;
    const tqGain = m.avg_tq_gain || 0;

    if (hpGain > 0 || tqGain > 0) {
      const factor = addedPowerMods > 0 ? gainFactor : 1.0;
      hp += Math.round(hpGain * factor);
      tq += Math.round(tqGain * factor);
      addedPowerMods++;
      gainFactor *= 0.95; // Each additional mod has diminishing returns
    }
    
    if (m.needs_tune) {
      notes.push(`${m.name} typically benefits most with a tune.`);
    }
  }

  // Calculate power-to-weight ratio
  const p2w = weight > 0 ? hp / weight : 0;

  // Estimate 0-60 time
  let zeroToSixty = car.zero_to_sixty_s_stock || null;
  if (!zeroToSixty && hp > 0 && weight > 0) {
    zeroToSixty = estimateZeroToSixty(hp, weight, car.drivetrain);
    notes.push('0-60 time estimated based on power-to-weight ratio and drivetrain.');
  }

  // Estimate quarter mile time
  let quarterMile = car.quarter_mile_s_stock || null;
  if (!quarterMile && hp > 0 && weight > 0) {
    quarterMile = estimateQuarterMile(hp, weight, car.drivetrain);
    notes.push('Quarter mile time estimated based on power-to-weight ratio.');
  }

  return {
    estimatedHp: hp,
    estimatedTq: tq,
    estimatedWeight: Math.round(weight),
    powerToWeight: p2w,
    zeroToSixty,
    quarterMile,
    notes,
  };
}

// Estimate horsepower based on vehicle characteristics
function estimateHpByVehicle(car: any): number {
  const year = car.year || 2020;
  const make = (car.make || '').toLowerCase();
  const model = (car.model || '').toLowerCase();
  const trim = (car.trim_label || '').toLowerCase();

  // Performance indicators in trim names
  const isPerformance = /m3|m5|amg|rs|type r|sti|wrx|gt|gti|si|sport|turbo|supercharged/i.test(trim);
  const isEconomy = /base|eco|hybrid|lx|le|s|se(?!dan)|l(?!s)|dx/i.test(trim);

  // Base estimates by make and era
  let baseHp = 200; // Default fallback

  // Make-specific baselines
  if (make.includes('honda')) {
    baseHp = isPerformance ? 300 : isEconomy ? 150 : 180;
  } else if (make.includes('toyota')) {
    baseHp = isPerformance ? 280 : isEconomy ? 140 : 170;
  } else if (make.includes('bmw')) {
    baseHp = isPerformance ? 400 : isEconomy ? 180 : 250;
  } else if (make.includes('mercedes')) {
    baseHp = isPerformance ? 450 : isEconomy ? 200 : 270;
  } else if (make.includes('audi')) {
    baseHp = isPerformance ? 380 : isEconomy ? 190 : 240;
  } else if (make.includes('ford')) {
    baseHp = isPerformance ? 350 : isEconomy ? 160 : 200;
  } else if (make.includes('chevrolet')) {
    baseHp = isPerformance ? 400 : isEconomy ? 170 : 220;
  } else if (make.includes('subaru')) {
    baseHp = isPerformance ? 300 : isEconomy ? 150 : 180;
  } else if (make.includes('nissan')) {
    baseHp = isPerformance ? 350 : isEconomy ? 160 : 190;
  }

  // Year adjustments (older cars generally have less power)
  if (year < 2000) baseHp *= 0.8;
  else if (year < 2010) baseHp *= 0.9;
  else if (year > 2020) baseHp *= 1.1;

  // Model-specific adjustments
  if (model.includes('civic') && isPerformance) baseHp = 300;
  if (model.includes('accord') && isPerformance) baseHp = 280;
  if (model.includes('mustang')) baseHp = isPerformance ? 450 : 300;
  if (model.includes('camaro')) baseHp = isPerformance ? 650 : 275;
  if (model.includes('corvette')) baseHp = 500;
  if (model.includes('911')) baseHp = 380;

  return Math.round(baseHp);
}

// Estimate weight based on vehicle characteristics
function estimateWeightByVehicle(car: any): number {
  const make = (car.make || '').toLowerCase();
  const model = (car.model || '').toLowerCase();
  const year = car.year || 2020;

  let baseWeight = 3200; // Default fallback

  // Size class estimation
  const isSubcompact = /civic|corolla|sentra|versa|rio|accent/i.test(model);
  const isCompact = /accord|camry|altima|jetta|focus/i.test(model);
  const isMidsize = /maxima|passat|legacy|tsx/i.test(model);
  const isFullsize = /avalon|impala|300|charger/i.test(model);
  const isSports = /corvette|911|mustang|camaro|challenger/i.test(model);
  const isLuxury = /bmw|mercedes|audi|lexus|infiniti|acura/i.test(make);
  const isTruck = /f-150|silverado|ram|tundra|titan/i.test(model);
  const isSUV = /explorer|tahoe|suburban|escalade|x5|q7|gle/i.test(model);

  if (isSubcompact) baseWeight = 2800;
  else if (isCompact) baseWeight = 3200;
  else if (isMidsize) baseWeight = 3600;
  else if (isFullsize) baseWeight = 4000;
  else if (isSports) baseWeight = 3400;
  else if (isTruck) baseWeight = 5000;
  else if (isSUV) baseWeight = 4500;

  // Luxury adds weight
  if (isLuxury) baseWeight += 300;

  // Year adjustments (newer cars are generally heavier due to safety equipment)
  if (year < 2000) baseWeight *= 0.85;
  else if (year < 2010) baseWeight *= 0.95;
  else if (year > 2020) baseWeight *= 1.05;

  return Math.round(baseWeight);
}

// Estimate 0-60 time based on power, weight, and drivetrain
function estimateZeroToSixty(hp: number, weight: number, drivetrain?: string): number {
  // Convert to wheel horsepower (account for drivetrain losses)
  const drivetrainEfficiency = getDrivetrainEfficiency(drivetrain);
  const whp = hp * drivetrainEfficiency;
  
  // Power-to-weight ratio in WHP per pound
  const powerToWeight = whp / weight;
  
  // Base formula: 0-60 ≈ K / (power-to-weight)^n
  // Where K and n are empirically derived constants
  let baseTime = 325 / Math.pow(powerToWeight * 1000, 0.85);
  
  // Drivetrain adjustments for launch
  const drivetrainFactor = getDrivetrainLaunchFactor(drivetrain);
  baseTime *= drivetrainFactor;
  
  // Clamp to realistic values (1.8s to 12.0s)
  baseTime = Math.max(1.8, Math.min(12.0, baseTime));
  
  return Math.round(baseTime * 10) / 10; // Round to 1 decimal
}

// Estimate quarter mile time
function estimateQuarterMile(hp: number, weight: number, drivetrain?: string): number {
  // Convert to wheel horsepower
  const drivetrainEfficiency = getDrivetrainEfficiency(drivetrain);
  const whp = hp * drivetrainEfficiency;
  
  // Power-to-weight ratio
  const powerToWeight = whp / weight;
  
  // Quarter mile estimation formula
  let quarterTime = 5.825 / Math.pow(powerToWeight, 0.333);
  
  // Drivetrain adjustments
  const drivetrainFactor = getDrivetrainLaunchFactor(drivetrain);
  quarterTime *= Math.sqrt(drivetrainFactor); // Less impact on quarter mile than 0-60
  
  // Clamp to realistic values (8.0s to 20.0s)
  quarterTime = Math.max(8.0, Math.min(20.0, quarterTime));
  
  return Math.round(quarterTime * 100) / 100; // Round to 2 decimals
}

// Get drivetrain efficiency (transmission losses)
function getDrivetrainEfficiency(drivetrain?: string): number {
  switch (drivetrain?.toUpperCase()) {
    case 'RWD': return 0.85; // ~15% loss
    case 'FWD': return 0.87; // ~13% loss  
    case 'AWD': return 0.82; // ~18% loss
    default: return 0.85; // Default to RWD
  }
}

// Get drivetrain launch factor (affects acceleration)
function getDrivetrainLaunchFactor(drivetrain?: string): number {
  switch (drivetrain?.toUpperCase()) {
    case 'RWD': return 0.95; // Good for launches, less traction off the line
    case 'FWD': return 1.05; // Traction limited, wheel spin
    case 'AWD': return 0.90; // Best traction, optimal launches
    default: return 1.0; // Neutral
  }
}
