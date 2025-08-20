// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-composer-controller.js.es6

import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "discourse-i18n";

export default {
  name: "lottery-composer-controller",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      api.modifyClass("controller:composer", {
        pluginId: "DiscourseLotteryV3",

        // 采纳建议：将 computed 属性改为一个普通的函数，更健壮
        showLotteryForm() {
          return this.get('model.action') === 'createTopic';
        },

        minParticipantsError: null,

        backupStrategyOptions: [
          { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
          { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
        ],

        actions: {
          validateMinParticipants() {
            const minParticipants = this.get("model.lotteryMinParticipants");
            const globalMin = api.container.lookup("site-settings:main").lottery_min_participants_global;

            if (minParticipants && parseInt(minParticipants, 10) < globalMin) {
              this.set("minParticipantsError", I18n.t('lottery.form.min_participants.error', { count: globalMin }));
            } else {
              this.set("minParticipantsError", null);
            }
          },
        },

        _gatherLotteryData() {
          const data = {};
          data.prize_name = this.get("model.lotteryPrizeName");
          data.prize_details = this.get("model.lotteryPrizeDetails");
          data.draw_time = this.get("model.lotteryDrawTime");
          data.winners_count = this.get("model.lotteryWinnersCount");
          data.specified_post_numbers = this.get("model.lotterySpecifiedPosts");
          data.min_participants = this.get("model.lotteryMinParticipants");
          data.backup_strategy = this.get("model.lotteryBackupStrategy") || 'continue';

          return Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        },

        save(options) {
          // 采纳建议：调用函数时需要加 ()
          if (this.showLotteryForm()) {
            const lotteryData = this._gatherLotteryData();
            if (Object.keys(lotteryData).length > 0) {
              this.get("model").set("custom_fields.lottery", JSON.stringify(lotteryData));
            }
          }
          return this._super(options);
        }
      });
    });
  },
};
