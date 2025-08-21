import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;

  // 获取允许的分类ID列表（category_list 必用 | 分隔，数字ID）
 get allowedCategoryIds() {
  const setting = window.settings?.lottery_allowed_categories || "";
  return setting
    .split("|")
    .map(s => Number(s))
    .filter(id => !isNaN(id));
}

get currentCategoryId() {
  return Number(this.composer?.model?.category_id || this.args?.topic?.category_id || 0);
}

get canShowLotteryForm() {
  // 注意allowedCategoryIds必须是有效数组，currentCategoryId有效数字且非0
  return (
    Array.isArray(this.allowedCategoryIds) &&
    this.allowedCategoryIds.length > 0 &&
    !!this.currentCategoryId &&
    this.allowedCategoryIds.includes(this.currentCategoryId)
  );
}
