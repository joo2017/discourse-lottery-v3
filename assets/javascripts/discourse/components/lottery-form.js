import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import I18n from "discourse-i18n";

export default class LotteryForm extends Component {
  @tracked formData = {};

  @tracked minParticipantsError = null;

  backupStrategyOptions = [
    { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
    { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
  ];

  constructor() {
    super(...arguments);
    // 初始化时从 model.prefill
    if (this.args.model.lotteryFormData) {
      this.formData = { ...this.args.model.lotteryFormData };
    }
  }

  @action
  updateLotteryData(field, event) {
    this.formData = { ...this.formData, [field]: event.target.value }
    this.args.model.lotteryFormData = { ...this.formData };
  }

  @action
  updateLotteryDataFromComponent(field, value) {
    this.formData = { ...this.formData, [field]: value }
    this.args.model.lotteryFormData = { ...this.formData };
  }

  @action
  validateMinParticipants(value) {
    this.formData = { ...this.formData, min_participants: value };
    this.args.model.lotteryFormData = { ...this.formData };

    const siteSettings = this.args.siteSettings;
    if (value && parseInt(value, 10) < siteSettings.lottery_min_participants_global) {
      this.minParticipantsError = I18n.t('lottery.form.min_participants.error', { count: siteSettings.lottery_min_participants_global });
    } else {
      this.minParticipantsError = null;
    }
  }
}
