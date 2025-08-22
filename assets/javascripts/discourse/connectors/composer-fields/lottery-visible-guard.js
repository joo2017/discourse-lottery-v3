import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;
  @service siteSettings;

  constructor() {
    super(...arguments);
    console.log("🎲 LotteryVisibleGuard constructor called");
    console.log("🎲 Args:", this.args);
    console.log("🎲 Composer service:", this.composer);
    console.log("🎲 SiteSettings service:", this.siteSettings);
  }

  get allowedCategoryIds() {
    console.log("🎲 allowedCategoryIds getter called");
    
    const setting = this.siteSettings?.lottery_allowed_categories || "";
    console.log("🎲 Raw setting:", setting, typeof setting);
    
    if (!setting) {
      console.log("🎲 No setting found, returning empty array");
      return [];
    }
    
    const ids = setting
      .split("|")
      .map(s => {
        const trimmed = s.trim();
        const num = Number(trimmed);
        console.log(`🎲 Processing: "${s}" -> "${trimmed}" -> ${num}`);
        return num;
      })
      .filter(id => {
        const isValid = !isNaN(id) && id > 0;
        console.log(`🎲 ID ${id} is valid:`, isValid);
        return isValid;
      });
    
    console.log("🎲 Final allowedCategoryIds:", ids);
    return ids;
  }

  get currentCategoryId() {
    console.log("🎲 currentCategoryId getter called");
    
    let categoryId = 0;
    
    console.log("🎲 Checking composer.model...");
    if (this.composer?.model) {
      console.log("🎲 Composer model exists:", this.composer.model);
      console.log("🎲 All model keys:", Object.keys(this.composer.model));
      
      // 尝试所有可能的属性
      const possibleKeys = ['categoryId', 'category_id', 'category'];
      possibleKeys.forEach(key => {
        const value = this.composer.model[key];
        console.log(`🎲 model.${key}:`, value);
      });
      
      categoryId = this.composer.model.categoryId || 
                   this.composer.model.category_id || 
                   this.composer.model.category?.id ||
                   0;
    } else {
      console.log("🎲 No composer.model found");
    }
    
    console.log("🎲 Checking args.topic...");
    if (this.args?.topic) {
      console.log("🎲 Args topic exists:", this.args.topic);
      categoryId = categoryId || this.args.topic.category_id || this.args.topic.categoryId || 0;
    } else {
      console.log("🎲 No args.topic found");
    }
    
    categoryId = Number(categoryId);
    console.log("🎲 Final currentCategoryId:", categoryId);
    
    return categoryId;
  }

  get canShowLotteryForm() {
    console.log("🎲 canShowLotteryForm getter called");
    
    const allowedIds = this.allowedCategoryIds;
    const currentId = this.currentCategoryId;
    
    console.log("🎲 Checking visibility conditions:");
    console.log("  🎯 allowedIds:", allowedIds);
    console.log("  🎯 currentId:", currentId);
    console.log("  🎯 allowedIds.length > 0:", allowedIds.length > 0);
    console.log("  🎯 currentId > 0:", currentId > 0);
    console.log("  🎯 allowedIds.includes(currentId):", allowedIds.includes(currentId));
    
    const result = allowedIds.length > 0 && currentId > 0 && allowedIds.includes(currentId);
    console.log("  🎯 FINAL RESULT:", result);
    
    // 强制返回false来测试
    // return false;
    
    return result;
  }
}
