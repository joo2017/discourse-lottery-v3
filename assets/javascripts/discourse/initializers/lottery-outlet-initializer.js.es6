// file: discourse-lottery-v3/assets/javascripts/discourse/components/lottery-form.js

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import I18n from "discourse-i18n";

export default class LotteryForm extends Component {
  @tracked minParticipantsError = null;

  // 这是 Glimmer 组件的特性，可以直接在模板中使用，无需 computed
  backupStrategyOptions = [
    { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
    { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
  ];

  constructor() {
    super(...arguments);
    // 在 Glimmer 组件中，我们在构造函数里初始化数据
    // 我们将把表单数据直接存储在 composer model 上
    this.args.model.lotteryFormData = {};
  }

  @action
  updateLotteryData(field, event) {
    const value = event.target.value;
    this.args.model.lotteryFormData[field] = value;
  }

  @action
  updateLotteryDataComponent(field, value) {
    // 用于处理非标准 input 元素的组件，如 date-picker 和 combo-box
    this.args.model.lotteryFormData[field] = value;
  }
  
  @action
  validateMinParticipants(event) {
    const value = event.target.value;
    this.args.model.lotteryFormData['min_participants'] = value;
    
    // 从 this.args 中安全地获取 siteSettings
    const siteSettings = this.args.siteSettings;
    if (value && parseInt(value, 10) < siteSettings.lottery_min_participants_global) {
      this.minParticipantsError = I18n.t('lottery.form.min_participants.error', { count: siteSettings.lottery_min_participants_global });
    } else {
      this.minParticipantsError = null;
    }
  }
}
