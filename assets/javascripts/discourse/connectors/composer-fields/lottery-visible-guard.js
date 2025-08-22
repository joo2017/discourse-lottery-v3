import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;
  @service siteSettings;

  get allowedCategoryIds() {
    const setting = this.siteSettings.lottery_allowed_categories || "";
    console.log("DEBUG lottery_allowed_categories setting:", setting);
    
    const ids = setting
      .split("|")
      .map(s => Number(s.trim()))
      .filter(id => !isNaN(id) && id > 0);
    
    console.log("DEBUG parsed allowedCategoryIds:", ids);
    return ids;
  }

  get currentCategoryId() {
    let categoryId = this.composer?.model?.categoryId || 
                     this.composer?.model?.category_id ||
                     this.args?.topic?.category_id || 
                     0;
    
    categoryId = Number(categoryId);
    
    console.log("DEBUG currentCategoryId:", categoryId);
    console.log("DEBUG composer.model.categoryId:", this.composer?.model?.categoryId);
    console.log("DEBUG composer.model.category_id:", this.composer?.model?.category_id);
    
    return categoryId;
  }

  get canShowLotteryForm() {
    const allowedIds = this.allowedCategoryIds;
    const currentId = this.currentCategoryId;
    const result = allowedIds.length > 0 && currentId > 0 && allowedIds.includes(currentId);
    
    console.log("DEBUG Visibility check:");
    console.log("  allowedIds:", allowedIds);
    console.log("  currentId:", currentId);
    console.log("  FINAL RESULT:", result);
    
    return result;
  }
}
