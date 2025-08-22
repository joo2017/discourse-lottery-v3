import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;
  @service siteSettings;

  get allowedCategoryIds() {
    const setting = this.siteSettings.lottery_allowed_categories || "";
    return setting
      .split("|")
      .map(s => Number(s.trim()))
      .filter(id => !isNaN(id) && id > 0);
  }

  get currentCategoryId() {
    let categoryId = 0;
    
    if (this.composer?.model) {
      categoryId = this.composer.model.categoryId || 
                   this.composer.model.category_id || 
                   this.composer.model.category?.id ||
                   0;
    }
    
    if (!categoryId && this.args?.topic) {
      categoryId = this.args.topic.category_id || this.args.topic.categoryId || 0;
    }
    
    return Number(categoryId);
  }

  get canShowLotteryForm() {
    const allowedIds = this.allowedCategoryIds;
    const currentId = this.currentCategoryId;
    
    return allowedIds.length > 0 && currentId > 0 && allowedIds.includes(currentId);
  }
}
