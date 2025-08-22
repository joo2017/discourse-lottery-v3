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
    // 尝试多种方式获取当前分类ID
    let categoryId = 0;
    
    if (this.composer?.model) {
      categoryId = this.composer.model.categoryId || 
                   this.composer.model.category_id || 
                   this.composer.model.category?.id ||
                   0;
    }
    
    // 如果还是0，尝试从args获取
    if (!categoryId && this.args?.topic) {
      categoryId = this.args.topic.category_id || this.args.topic.categoryId || 0;
    }
    
    categoryId = Number(categoryId);
    
    console.log("DEBUG currentCategoryId:", categoryId);
    console.log("DEBUG composer model:", this.composer?.model);
    
    return categoryId;
  }

  get canShowLotteryForm() {
    const allowedIds = this.allowedCategoryIds;
    const currentId = this.currentCategoryId;
    
    // 详细的判断逻辑
    const hasAllowedIds = allowedIds.length > 0;
    const hasCurrentId = currentId > 0;
    const isAllowed = allowedIds.includes(currentId);
    
    console.log("DEBUG Visibility check:");
    console.log("  allowedIds:", allowedIds);
    console.log("  currentId:", currentId);
    console.log("  hasAllowedIds:", hasAllowedIds);
    console.log("  hasCurrentId:", hasCurrentId);
    console.log("  isAllowed:", isAllowed);
    
    const result = hasAllowedIds && hasCurrentId && isAllowed;
    console.log("  FINAL RESULT:", result);
    
    return result;
  }
}
