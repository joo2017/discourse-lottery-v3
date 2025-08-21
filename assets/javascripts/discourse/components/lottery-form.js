// file: discourse-lottery-v3/assets/javascripts/discourse/components/lottery-form.js

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import I18n from "discourse-i18n";

export default class LotteryForm extends Component {
  @tracked minParticipantsError = null;

  // 新增：一个 getter，用于判断组件自身是否应该显示
  get shouldShow() {
    const siteSettings = this.args.siteSettings;
    if (!siteSettings.lottery_enabled) {
      return false;
    }

    const allowedCategoriesSetting = siteSettings.lottery_allowed_categories || "";
    const allowedCategories = allowedCategoriesSetting.split('|').map(Number).filter(id => id > 0);
    
    // 使用可选链操作符 ?. 来安全地访问属性，防止 model 不存在时报错
    const composerAction = this.args.model?.action;
    const currentCategoryId = this.args.model?.categoryId;

    return composerAction === 'createTopic' &&
           allowedCategories.length > 0 &&
           allowedCategories.includes(currentCategoryId);
  }

  backupStrategyOptions = [
    { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
    { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
  ];

  constructor() {
    super(...arguments);
    // 只有在 model 存在时才初始化数据
    if (this.args.model && !this.args.model.lotteryFormData) {
      this.args.model.lotteryFormData = {};
    }
  }

  @action
  updateLotteryData(field, event) {
    const value = event.target.value;
    this.args.model.lotteryFormData[field] = value;
  }

  @action
  updateLotteryDataFromComponent(field, value) {
    this.args.model.lotteryFormData[field] = value;
  }
  
  @action
  validateMinParticipants(value) {
    const siteSettings = this.args.siteSettings;
    this.args.model.lotteryFormData['min_participants'] = value;
    if (value && parseInt(value, 10) < siteSettings.lottery_min_participants_global) {
      this.minParticipantsError = I18n.t('lottery.form.min_participants.error', { count: siteSettings.lottery_min_participants_global });
    } else {
      this.minParticipantsError = null;
    }
  }
}
