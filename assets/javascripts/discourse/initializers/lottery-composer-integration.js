// assets/javascripts/discourse/initializers/lottery-composer-integration.js
// 修复版本 - 基于discourse-calendar最佳实践

import { withPluginApi } from "discourse/lib/plugin-api";
import LotteryFormModal from "../components/modal/lottery-form-modal";

export default {
  name: "lottery-composer-integration",
  initialize() {
    withPluginApi("1.4.0", (api) => {
      console.log("🎲 Lottery: Initializing composer integration");

      // 修复1: 序列化数据传递
      api.serializeOnCreate('lottery_data');
      api.serializeToDraft('lottery_data');
      api.serializeToTopic('lottery_data', 'topic.lottery_data');

      // 修复2: 检查分类权限的函数
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
        return allowedIds.length === 0 || allowedIds.includes(currentCategoryId);
      }

      // 修复3: 工具栏按钮配置
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
              api.container.lookup("service:dialog").alert("抽奖功能已被管理员关闭");
              return;
            }

            if (!canInsertLottery()) {
              api.container.lookup("service:dialog").alert("当前分类不支持抽奖功能");
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

      // 修复4: 扩展Composer控制器
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",
        
        save(options = {}) {
          console.log("🎲 Composer save intercepted");
          
          const model = this.get("model");
          const content = model.get("reply") || "";
          
          // 检查内容中是否有抽奖标记
          const lotteryMatch = content.match(/\[lottery\](.*?)\[\/lottery\]/s);
          
          if (lotteryMatch) {
            console.log("🎲 Found lottery content in post");
            
            try {
              const lotteryData = this.extractAndValidateLotteryData(lotteryMatch[1]);
              
              if (lotteryData) {
                console.log("🎲 Setting lottery data for transmission");
                
                // 修复：使用多种方式传递数据
                const jsonData = JSON.stringify(lotteryData);
                
                // 方法1: 设置到模型的lottery_data属性
                model.set("lottery_data", jsonData);
                
                // 方法2: 设置到custom_fields
                if (!model.custom_fields) {
                  model.set("custom_fields", {});
                }
                model.set("custom_fields.lottery_data", jsonData);
                model.set("custom_fields.lottery", jsonData); // 备用字段名
                
                // 方法3: 设置到opts
                if (!options.lottery_data) {
                  options.lottery_data = jsonData;
                }
                
                // 方法4: 设置到模型的opts
                let modelOpts = model.get("opts") || {};
                modelOpts.lottery_data = jsonData;
                model.set("opts", modelOpts);
                
                // 通知属性变化
                model.notifyPropertyChange("lottery_data");
                model.notifyPropertyChange("custom_fields");
                model.notifyPropertyChange("opts");
                
                console.log("🎲 Lottery data set using multiple transmission paths");
              }
            } catch (error) {
              console.error("🎲 Error processing lottery data:", error);
              
              const dialog = this.get("dialog") || api.container.lookup("service:dialog");
              dialog.alert(`抽奖数据处理失败: ${error.message}`);
              return;
            }
          }
          
          return this._super(options);
        },
        
        // 修复5: 改进的数据提取和验证
        extractAndValidateLotteryData(lotteryContent) {
          console.log("🎲 Extracting lottery data from content");
          
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
                case '指定中奖楼层':
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
          
          // 设置默认值
          data.backup_strategy = data.backup_strategy || 'continue';
          
          // 验证必填字段
          if (!data.prize_name || !data.prize_details || !data.draw_time) {
            throw new Error("缺少必填字段：活动名称、奖品说明或开奖时间");
          }
          
          // 验证时间格式
          try {
            const drawDate = new Date(data.draw_time);
            if (isNaN(drawDate.getTime()) || drawDate <= new Date()) {
              throw new Error("开奖时间无效或不是未来时间");
            }
          } catch (e) {
            throw new Error("开奖时间格式错误");
          }
          
          // 验证参与门槛
          const siteSettings = api.container.lookup("service:site-settings");
          const globalMin = siteSettings?.lottery_min_participants_global || 5;
          
          if (data.min_participants < globalMin) {
            throw new Error(`参与门槛不能低于全局设置的 ${globalMin} 人`);
          }
          
          console.log("🎲 Lottery data validation passed:", data);
          return data;
        }
      });

      // 修复6: 扩展Composer模型的序列化
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",
        
        serialize(serializer, dest) {
          const result = this._super(serializer, dest);
          
          // 确保lottery_data被序列化
          if (this.lottery_data) {
            result.lottery_data = this.lottery_data;
            console.log("🎲 Model serialization: included lottery_data");
          }
          
          if (this.custom_fields?.lottery_data) {
            result.lottery_data = this.custom_fields.lottery_data;
            console.log("🎲 Model serialization: included lottery_data from custom_fields");
          }
          
          return result;
        }
      });

      console.log("🎲 Lottery: Composer integration completed");
    });
  },
};
