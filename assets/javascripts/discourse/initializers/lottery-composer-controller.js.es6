// file: discourse-lottery-v3/assets/javascripts/discourse/initializers/lottery-composer-controller.js.es6

import { withPluginApi } from "discourse/lib/plugin-api";
import I18n from "discourse-i18n";
// 核心修正：从 @ember/object 模块中导入 `computed` 功能。
import { computed } from "@ember/object";


export default {
  name: "lottery-composer-controller",

  initialize() {
    // 我们可以移除调试日志了，因为问题已经找到
    // console.log("Lottery Plugin: Initializer running!");

    withPluginApi("1.0.0", (api) => {
      // console.log("Lottery Plugin: Attempting to modify Composer Controller...");

      api.modifyClass("controller:composer", {
        pluginId: "DiscourseLotteryV3", 

        // 核心修正：使用正确导入的 `computed` 函数
        showLotteryForm: computed('model.action', function() {
          return this.get('model.action') === 'createTopic';
        }),

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
          if (this.showLotteryForm) {
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
