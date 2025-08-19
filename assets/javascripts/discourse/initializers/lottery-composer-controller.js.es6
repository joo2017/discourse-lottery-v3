// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-composer-controller.js.es6

import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "discourse-i18n";

export default {
  name: "lottery-composer-controller",

  initialize() {
    // 探针 1 (我们已经确认它可以工作)
    console.log("Lottery Plugin: Initializer running!");

    withPluginApi("1.0.0", (api) => {
      // ================== DEBUGGING PROBE 2 ==================
      // 这是新的、更深层的探针。
      // 如果我们能看到这条日志，说明 api.modifyClass 至少被调用了。
      console.log("Lottery Plugin: Attempting to modify Composer Controller...");
      // =======================================================

      api.modifyClass("controller:composer", {
        pluginId: "DiscourseLotteryV3", 

        // 我们把 showLotteryForm 的逻辑改得更健壮一些
        // 使用 computed property 来确保它只在新建主题时为 true
        showLotteryForm: Ember.computed.equal('model.action', 'createTopic'),

        minParticipantsError: null,

        backupStrategyOptions: [
          { id: 'continue', name: I18n.t('lottery.form.backup_strategy.options.continue') },
          { id: 'cancel', name: I18n.t('lottery.form.backup_strategy.options.cancel') }
        ],

        actions: {
          validateMinParticipants() {
            // ================== DEBUGGING PROBE 3 ==================
            // 如果连这个日志都能看到，那就说明一切正常，问题可能非常诡异
            console.log("Lottery Plugin: validateMinParticipants action triggered!");
            // =======================================================
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
          if (this.showLotteryForm) { // 现在可以直接用这个属性了
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
