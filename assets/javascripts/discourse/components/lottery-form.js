// file: discourse-lottery-v3/assets/javascripts/discourse/components/lottery-form.js (Optimized)

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import I18n from "discourse-i18n";

export default class LotteryForm extends Component {
  @tracked minParticipantsError = null;

  backupStrategyOptions = [
    { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
    { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
  ];

  constructor() {
    super(...arguments);
    // [OPTIMIZATION] 增加存在性检查，防止草稿恢复等场景下数据被覆盖
    if (!this.args.model.lotteryFormData) {
      this.args.model.lotteryFormData = {};
    }
  }

  // 用于标准 HTML 输入元素 (input, textarea)
  @action
  updateLotteryData(field, event) {
    const value = event.target.value;
    this.args.model.lotteryFormData[field] = value;
  }

  // 用于 Discourse 的 Ember 组件 (DateTimePicker, ComboBox, NumberInput)
  @action
  updateLotteryDataFromComponent(field, value) {
    this.args.model.lotteryFormData[field] = value;
  }
  
  // 专门处理参与门槛的验证
  @action
  validateMinParticipants(value) {
    this.args.model.lotteryFormData['min_participants'] = value;
    
    const siteSettings = this.args.siteSettings;
    if (value && parseInt(value, 10) < siteSettings.lottery_min_participants_global) {
      this.minParticipantsError = I18n.t('lottery.form.min_participants.error', { count: siteSettings.lottery_min_participants_global });
    } else {
      this.minParticipantsError = null;
    }
  }
}
