import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import SiteSetting from "discourse/lib/site-settings";
import { computed } from "@ember/object";

export default class LotteryVisibleGuard extends Component {
  @service site;
  @service composer;

  // 获取允许的category_id数组（category_list SiteSetting 存的是逗号分隔ID字符串）
  get allowedCategoryIds() {
    const setting = SiteSetting.lottery_allowed_categories;
    return setting
      .split("|")
      .map(s => Number(s))
      .filter(Boolean);
  }

  // 获取当前选择的category_id
  get currentCategoryId() {
    // 新建主题时，category_id 可能挂在 composer.model 也可能是args.topic.category_id
    // 在“创建新主题”场景下 composer.model.category_id 就是目标分类
    if (this.composer?.model?.category_id) {
      return this.composer.model.category_id;
    }
    // 兜底：编辑主题时可能传了 args.topic
    if (this.args?.topic?.category_id) {
      return this.args.topic.category_id;
    }
    return null;
  }

  get canShowLotteryForm() {
    // 不设置限制时(空值)，不显示表单
    if (!this.allowedCategoryIds.length || !this.currentCategoryId) return false;
    return this.allowedCategoryIds.includes(this.currentCategoryId);
  }
}
