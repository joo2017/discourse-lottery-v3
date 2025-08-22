import Component from "@glimmer/component";
import { inject as service } from "@ember/service";

export default class LotteryVisibleGuard extends Component {
  @service composer;
  @service siteSettings; // 注入 siteSettings 服务

  // 获取允许的分类ID列表（category_list 必用 | 分隔，数字ID）
  get allowedCategoryIds() {
    // 从 siteSettings 服务中读取设置，而不是从全局 window 对象
    const setting = this.siteSettings.lottery_allowed_categories || "";
    return setting
      .split("|")
      .map(s => Number(s))
      .filter(id => !isNaN(id));
  }

  // 获取当前选择的分类ID，没有就为0
  get currentCategoryId() {
    // 新建/编辑主题都考虑
    return Number(this.composer?.model?.category_id || this.args?.topic?.category_id || 0);
  }

  // 是否在允许的分类中显示表单
  get canShowLotteryForm() {
    // 增加一个总开关的判断，更加严谨
    if (!this.siteSettings.lottery_enabled) {
      return false;
    }

    return (
      this.allowedCategoryIds.length > 0 &&
      this.allowedCategoryIds.includes(this.currentCategoryId)
    );
  }
}
