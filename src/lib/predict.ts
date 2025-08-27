export function basePredict(car: any, mods: any[]) {
    const notes: string[] = [];
    let hp = car.stock_hp;
    let tq = car.stock_tq;
    let weight = car.curb_weight_lbs;
  
    let gainFactor = 0.9; // diminishing returns after first power mod
    let addedPowerMods = 0;
  
    for (const m of mods) {
      weight += m.avg_weight_delta_lbs || 0;
      const hpGain = m.avg_hp_gain || 0;
      const tqGain = m.avg_tq_gain || 0;
  
      if (hpGain > 0 || tqGain > 0) {
        const factor = addedPowerMods > 0 ? gainFactor : 1.0;
        hp += Math.round(hpGain * factor);
        tq += Math.round(tqGain * factor);
        addedPowerMods++;
        gainFactor *= 0.95;
      }
      if (m.needs_tune) notes.push(`${m.name} typically benefits most with a tune.`);
    }
  
    const p2w = hp / weight;
    const zeroToSixty = car.zero_to_sixty_s
      ? car.zero_to_sixty_s * (car.stock_hp / hp) * (weight / car.curb_weight_lbs)
      : null;
    const quarterMile = car.quarter_mile_s
      ? car.quarter_mile_s * Math.sqrt((car.curb_weight_lbs / weight) * (car.stock_hp / hp))
      : null;
  
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
  