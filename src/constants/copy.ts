/**
 * Shared copy for bag/beans terminology.
 * Set BAG_OR_BEANS to 'bag' or 'beans' to control timeline, dropdown, and dialog wording.
 */
export const BAG_OR_BEANS = 'bag' as const;

const unit = BAG_OR_BEANS;
const unitCap = unit.charAt(0).toUpperCase() + unit.slice(1);

export const COPY = {
  // Beans page / primary add CTA
  addBag: `Add ${unitCap}`,
  saveBag: `Save ${unitCap}`,
  editBagDetails: `Edit ${unitCap} Details`,
  // Timeline divider
  newBagLabel: `New ${unitCap}`,
  // New brew form dropdown
  changeBag: `Change ${unitCap}`,
  addNewBag: `Add New ${unitCap}`,
  // Coffee detail / table
  addAnotherBag: `Add Another ${unitCap}`,
  // Toasts
  newBagScanned: (roaster: string, name: string, roastInfo: string) =>
    `New ${unit} scanned: ${roaster} - ${name}${roastInfo}`,
  // Inline hint
  newBagAvailable: `New ${unit}`,
  // Finish-bag dialog
  previousBag: `previous ${unit}`,
  didYouFinishPreviousBag: `Did you finish the previous ${unit}?`,
  markBagsFinishedFromPage: `You can also mark ${unit}s as finished from the beans page.`,
  // Coffee detail nav arrows
  previousBagArrow: `Previous ${unit}`,
  nextBagArrow: `Next ${unit}`,
} as const;
