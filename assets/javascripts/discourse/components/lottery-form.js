// file: discourse-lottery-v3/assets/javascripts/discourse/components/lottery-form.js

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
    if (!this.args.model.lotteryFormData) {
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
    this.args.model.lotteryFormData['min_participants'] = value;
    
    const siteSettings = this.args.siteSettings;
    if (value && parseInt(value, 10) < siteSettings.lottery_min_participants_global) {
      this.minParticipantsError = I18n.t('lottery.form.min_participants.error', { count: siteSettings.lottery_min_participants_global });
    } else {
      this.minParticipantsError = null;
    }
  }
}
