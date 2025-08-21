import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;

  // 获取允许的分类ID列表（category_list 必用 | 分隔，数字ID）
  get allowedCategoryIds() {
    const setting = window.settings.lottery_allowed_categories || "";
    return setting
      .split("|")
      .map(s => Number(s))
      .filter(Boolean);
  }

  // 当前选中的分类ID（数字）
  get currentCategoryId() {
    return this.composer?.model?.category_id || this.args?.topic?.category_id || null;
  }

  get canShowLotteryForm() {
    return this.allowedCategoryIds.includes(this.currentCategoryId);
  }
}
