export function acceptMeasure(measure) {
  if (!measure) return;
  measure.review_status = "approved";
  measure.review_required = false;
  if (measure.confidence === "incerto") measure.confidence = "provável";
}

export function markMeasureUncertain(measure) {
  if (!measure) return;
  measure.review_status = "needs_fix";
  measure.review_required = true;
  measure.confidence = "incerto";
}
