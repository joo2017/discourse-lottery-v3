import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;
  @service siteSettings;

  // 获取允许的分类ID列表（category_list 必用 | 分隔，数字ID）
  get allowedCategoryIds() {
    const setting = this.siteSettings.lottery_allowed_categories || "";
    console.log("🎲 [DEBUG] lottery_allowed_categories setting:", setting);
    
    const ids = setting
      .split("|")
      .map(s => Number(s))
      .filter(id => !isNaN(id));
    
    console.log("🎲 [DEBUG] parsed allowedCategoryIds:", ids);
    return ids;
  }

  // 获取当前选择的分类ID，没有就为0
  get currentCategoryId() {
    const categoryId = Number(this.composer?.model?.category_id || this.args?.topic?.category_id || 0);
    console.log("🎲 [DEBUG] currentCategoryId:", categoryId);
    console.log("🎲 [DEBUG] composer.model:", this.composer?.model);
    console.log("🎲 [DEBUG] args.topic:", this.args?.topic);
    return categoryId;
  }

  // 是否在允许的分类中显示表单
  get canShowLotteryForm() {
    const allowedIds = this.allowedCategoryIds;
    const currentId = this.currentCategoryId;
    const isArray = Array.isArray(allowedIds);
    const hasLength = allowedIds.length > 0;
    const hasCurrentId = !!currentId;
    const isIncluded = allowedIds.includes(currentId);
    
    console.log("🎲 [DEBUG] Visibility check:");
    console.log("  - allowedIds:", allowedIds);
    console.log("  - currentId:", currentId);
    console.log("  - isArray:", isArray);
    console.log("  - hasLength:", hasLength);
    console.log("  - hasCurrentId:", hasCurrentId);
    console.log("  - isIncluded:", isIncluded);
    
    const result = isArray && hasLength && hasCurrentId && isIncluded;
    console.log("  - FINAL RESULT:", result);
    
    return result;
  }
}
