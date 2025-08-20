// file: discourse-lottery-v3/assets/javascripts/discourse/components/lottery-form.js

import Component from "@ember/component";
import { computed } from "@ember/object";
import I18n from "discourse-i18n";

export default Component.extend({
  tagName: "", // 组件本身不渲染多余的HTML标签
  minParticipantsError: null,
  
  // 组件初始化时，设置一个对象用于存储表单数据
  init() {
    this._super(...arguments);
    this.set("model.lotteryFormData", {});
  },

  backupStrategyOptions: computed(function () {
    return [
      { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
      { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
    ];
  }),

  actions: {
    // 数据双向绑定，当表单项变化时，更新 lotteryFormData 对象
    updateLotteryData(field, value) {
      this.set(`model.lotteryFormData.${field}`, value);
    },
    
    validateMinParticipants(value) {
      this.send('updateLotteryData', 'min_participants', value);
      const siteSettings = this.siteSettings;
      if (value && parseInt(value, 10) < siteSettings.lottery_min_participants_global) {
        this.set("minParticipantsError", I18n.t('lottery.form.min_participants.error', { count: siteSettings.lottery_min_participants_global }));
      } else {
        this.set("minParticipantsError", null);
      }
    }
  }
});
