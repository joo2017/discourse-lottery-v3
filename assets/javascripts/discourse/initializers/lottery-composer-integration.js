// ====================================================================
// 3. 修改文件：assets/javascripts/discourse/initializers/lottery-composer-integration.js
// ====================================================================

import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: 初始化编辑器集成");

      api.serializeOnCreate('lottery');
      api.serializeToDraft('lottery');
      api.serializeToTopic('lottery', 'topic.lottery');

      function canInsertLottery() {
        const composer = api.container.lookup("controller:composer");
        if (!composer) return false;

        const siteSettings = api.container.lookup("service:site-settings");
        const allowedCategories = siteSettings?.lottery_allowed_categories;
        
        if (!allowedCategories) return true;

        const allowedIds = allowedCategories
          .split("|")
          .map(id => Number(id.trim()))
          .filter(id => !isNaN(id) && id > 0);

        const currentCategoryId = Number(composer.get("model.categoryId") || 0);
        return allowedIds.includes(currentCategoryId);
      }

      api.onToolbarCreate((toolbar) => {
        toolbar.addButton({
          title: "插入抽奖",
          id: "insertLottery", 
          group: "extras",
          icon: "dice",
          shortcut: "Ctrl+Shift+L",
          perform: (e) => {
            const siteSettings = api.container.lookup("service:site-settings");
            
            if (!siteSettings?.lottery_enabled) {
              alert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              alert("当前分类不支持抽奖功能");
              return;
            }

            const modal = api.container.lookup("service:modal");
            const composer = api.container.lookup("controller:composer");
            
            modal.show(LotteryFormModal, {
              model: { 
                toolbarEvent: e,
                composer: composer,
                siteSettings: siteSettings
              }
            });
          }
        });
      });

      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options) {
          console.log("🎲 Composer save 开始");
          
          if (typeof options !== 'object' || options === null) {
            options = {};
          }
          
          const model = this.get("model");
          const content = model.get("reply") || "";
          const lotteryMatch = content.match(/\[lottery\](.*?)\[\/lottery\]/s);
          
          if (lotteryMatch) {
            console.log("🎲 检测到抽奖内容标记");
            
            const lotteryData = this.extractLotteryDataFromContent(lotteryMatch[1]);
            
            if (lotteryData && this.validateLotteryData(lotteryData)) {
              console.log("🎲 解析到有效的抽奖数据:", lotteryData);
              
              if (!model.custom_fields) {
                model.set("custom_fields", {});
              }
              model.set("custom_fields.lottery", JSON.stringify(lotteryData));
              model.set("lottery", JSON.stringify(lotteryData));
              options.lottery = JSON.stringify(lotteryData);
              
              let modelOpts = model.get("opts");
              if (!modelOpts || typeof modelOpts !== 'object') {
                modelOpts = {};
                model.set("opts", modelOpts);
              }
              modelOpts.lottery = JSON.stringify(lotteryData);
              
              model.notifyPropertyChange("custom_fields");
              model.notifyPropertyChange("lottery");
              model.notifyPropertyChange("opts");
              
              console.log("🎲 抽奖数据已设置到所有可能的传递路径");
            }
          }
          
          return this._super(options);
        },
        
        extractLotteryDataFromContent(lotteryContent) {
          console.log("🎲 解析抽奖内容:", lotteryContent);
          
          const data = {};
          const lines = lotteryContent.split('\n');
          
          lines.forEach(line => {
            line = line.trim();
            if (line && line.includes('：')) {
              const [key, value] = line.split('：', 2);
              const trimmedKey = key.trim();
              const trimmedValue = value ? value.trim() : '';
              
              switch (trimmedKey) {
                case '活动名称':
                  data.prize_name = trimmedValue;
                  break;
                case '奖品说明':
                  data.prize_details = trimmedValue;
                  break;
                case '开奖时间':
                  data.draw_time = trimmedValue;
                  break;
                case '获奖人数':
                  data.winners_count = parseInt(trimmedValue) || 1;
                  break;
                case '指定楼层':
                  if (trimmedValue) {
                    data.specified_posts = trimmedValue;
                  }
                  break;
                case '参与门槛':
                  const participants = trimmedValue.match(/\d+/);
                  data.min_participants = participants ? parseInt(participants[0]) : 5;
                  break;
                case '补充说明':
                  if (trimmedValue) {
                    data.additional_notes = trimmedValue;
                  }
                  break;
                case '奖品图片':
                  if (trimmedValue) {
                    data.prize_image = trimmedValue;
                  }
                  break;
              }
            }
          });
          
          data.backup_strategy = 'continue';
          
          console.log("🎲 解析结果:", data);
          return data;
        },
        
        validateLotteryData(data) {
          if (!data.prize_name || !data.prize_details || !data.draw_time) {
            console.log("🎲 抽奖数据验证失败：缺少必填字段");
            return false;
          }
          
          const drawDate = new Date(data.draw_time);
          if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
            console.log("🎲 抽奖数据验证失败：时间无效");
            return false;
          }
          
          console.log("🎲 抽奖数据验证通过");
          return true;
        }
      });

      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        serialize(serializer, dest) {
          const result = this._super(serializer, dest);
          
          if (this.custom_fields && this.custom_fields.lottery) {
            result.lottery = this.custom_fields.lottery;
            console.log("🎲 模型序列化：包含 lottery 数据");
          }
          
          if (this.get('lottery')) {
            result.lottery = this.get('lottery');
            console.log("🎲 模型序列化：从属性包含 lottery 数据");
          }
          
          return result;
        }
      });

      console.log("🎲 Lottery: 编辑器集成初始化完成");
    });
  },
};
