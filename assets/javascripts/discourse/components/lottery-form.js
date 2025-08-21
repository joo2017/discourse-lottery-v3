// file: discourse-lottery-v3/assets/javascripts/discourse/components/lottery-form.js

import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import I18n from "discourse-i18n";

export default class LotteryForm extends Component {
  @tracked minParticipantsError = null;

  // 严谨的显示判断 getter
  get shouldShow() {
    const s = this.args.siteSettings;
    if (!s?.lottery_enabled) return false;

    const allowedCats = (s.lottery_allowed_categories || "")
      .split("|")
      .map(Number)
      .filter(Boolean);

    const m = this.args.model;
    // 必须确保所有上下文数据都已准备就绪
    return (
      m &&
      m.action === "createTopic" &&
      m.categoryId &&
      allowedCats.length > 0 &&
      allowedCats.includes(m.categoryId)
    );
  }

  backupStrategyOptions = [
    { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
    { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
  ];

  constructor() {
    super(...arguments);
    // 彻底的数据初始化，确保所有绑定到模板的属性都有一个安全的默认值
    if (this.args.model && !this.args.model.lotteryFormData) {
      this.args.model.lotteryFormData = {};
    }
    
    const data = this.args.model?.lotteryFormData;
    if (data) {
      data.prize_name = data.prize_name || "";
      data.prize_details = data.prize_details || "";
      data.draw_time = data.draw_time || null;
      data.winners_count = data.winners_count || 1;
      data.specified_post_numbers = data.specified_post_numbers || "";
      // 安全地从 siteSettings 获取默认值
      data.min_participants = data.min_participants || this.args.siteSettings?.lottery_min_participants_global || 1;
      data.backup_strategy = data.backup_strategy || "continue";
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
