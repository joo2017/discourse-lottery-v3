import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;

  get allowedCategoryIds() {
    // window.settings 是 Discourse 全局注入对象
    // 注意，category_list 类型以逗号","分隔
    if (!window.settings || !window.settings.lottery_allowed_categories) return [];
    return window.settings.lottery_allowed_categories
      .split(",")
      .map(s => Number(s))
      .filter(Boolean);
  }

  get currentCategoryId() {
    return this.composer?.model?.category_id || this.args?.topic?.category_id || null;
  }

  get canShowLotteryForm() {
    if (!this.allowedCategoryIds.length || !this.currentCategoryId) return false;
    return this.allowedCategoryIds.includes(this.currentCategoryId);
  }
}
