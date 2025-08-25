// assets/javascripts/discourse/initializers/lottery-form-initializer.js
import { withPluginApi } from "discourse/lib/plugin-api";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖表单初始化器启动 - 使用官方推荐方法");

      // === 第一步：注册自定义字段序列化（官方推荐） ===
      api.serializeOnCreate('lottery_data');
      api.serializeOnCreate('lottery_status');
      api.serializeToDraft('lottery_data');
      api.serializeToDraft('lottery_status');
      api.serializeToTopic('lottery_data', 'topic.lottery_data');
      api.serializeToTopic('lottery_status', 'topic.lottery_status');

      console.log("🎲 已注册字段序列化");

      // === 第二步：扩展Topic模型（前端） - 修复版本 ===
      api.modifyClass('model:topic', {
        pluginId: 'discourse-lottery-v3',

        // 修复：使用computed替代.property()
        hasLottery: computed('lottery_data', function() {
          return this.lottery_data && Object.keys(this.lottery_data).length > 0;
        }),

        lotteryStatus: computed('lottery_status', function() {
          return this.lottery_status || 'none';
        }),

        // 移除observes，改用computed属性和手动调用
        init() {
          this._super(...arguments);
          this.updateCustomFields();
        },

        // 手动同步custom_fields
        updateCustomFields() {
          if (this.lottery_data) {
            if (!this.custom_fields) {
              this.set('custom_fields', {});
            }
            this.set('custom_fields.lottery_data', JSON.stringify(this.lottery_data));
            this.set('custom_fields.lottery_status', this.lottery_status);
          }
        }
      });

      console.log("🎲 已扩展Topic模型");

      // === 第三步：扩展Composer控制器（修复版本） ===
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        save(options) {
          console.log("🎲 Composer保存开始");
          
          const model = this.get("model");
          
          // 检查缓存数据
          if (window.lotteryFormDataCache) {
            console.log("🎲 发现缓存的抽奖数据:", window.lotteryFormDataCache);
            
            // 验证数据完整性
            const requiredFields = ['prize_name', 'prize_details', 'draw_time', 'min_participants'];
            const isValid = requiredFields.every(field => 
              window.lotteryFormDataCache[field] && 
              String(window.lotteryFormDataCache[field]).trim()
            );
            
            if (isValid) {
              console.log("🎲 缓存数据验证通过，设置到模型");
              
              // 官方推荐：直接设置到模型属性
              model.set('lottery_data', window.lotteryFormDataCache);
              model.set('lottery_status', 'running');
              
              // 标记属性变更（触发序列化）
              model.notifyPropertyChange('lottery_data');
              model.notifyPropertyChange('lottery_status');
              
              console.log("🎲 抽奖数据已设置到模型");
              console.log("🎲 模型lottery_data:", model.get('lottery_data'));
              console.log("🎲 模型lottery_status:", model.get('lottery_status'));
              
              // 清理缓存
              window.lotteryFormDataCache = null;
              console.log("🎲 已清理缓存数据");
            } else {
              console.warn("🎲 缓存数据验证失败，跳过设置");
            }
          }

          // 检查活动组件数据（备用方案）
          else if (window.currentLotteryForm) {
            console.log("🎲 发现活动组件抽奖数据");
            const componentData = window.currentLotteryForm.getLotteryData();
            
            if (componentData && componentData.prize_name) {
              console.log("🎲 组件数据有效，设置到模型");
              model.set('lottery_data', componentData);
              model.set('lottery_status', 'running');
              model.notifyPropertyChange('lottery_data');
              model.notifyPropertyChange('lottery_status');
            }
          }

          // 输出最终模型状态用于调试
          console.log("🎲 保存前模型状态:");
          console.log("  - lottery_data:", model.get('lottery_data'));
          console.log("  - lottery_status:", model.get('lottery_status'));
          console.log("  - custom_fields:", model.get('custom_fields'));
          
          return this._super(options);
        },

        // 扩展序列化方法确保数据包含
        serialize(options) {
          const data = this._super(options);
          const model = this.get('model');
          
          // 确保抽奖数据包含在序列化结果中
          if (model.get('lottery_data')) {
            data.lottery_data = model.get('lottery_data');
            data.lottery_status = model.get('lottery_status') || 'running';
            
            console.log("🎲 序列化时包含抽奖数据:", {
              lottery_data: data.lottery_data,
              lottery_status: data.lottery_status
            });
          }
          
          return data;
        }
      });

      console.log("🎲 已扩展Composer控制器");

      // === 第四步：扩展Composer模型确保数据传递 ===
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",

        // 确保在创建时传递自定义字段
        createPost(options) {
          if (this.lottery_data) {
            if (!options) options = {};
            if (!options.custom_fields) options.custom_fields = {};
            
            options.lottery_data = this.lottery_data;
            options.lottery_status = this.lottery_status || 'running';
            
            console.log("🎲 createPost时传递抽奖数据:", options);
          }
          
          return this._super(options);
        },

        // 扩展序列化以包含自定义字段
        serialize() {
          const result = this._super();
          
          if (this.lottery_data) {
            result.lottery_data = this.lottery_data;
            result.lottery_status = this.lottery_status || 'running';
            
            console.log("🎲 模型序列化包含抽奖数据");
          }
          
          return result;
        }
      });

      console.log("🎲 已扩展Composer模型");

      // === 第五步：调试和验证工具 ===
      
      // 监听topic创建事件进行调试
      api.onPageChange(() => {
        const topicController = api.container.lookup('controller:topic');
        if (topicController) {
          const model = topicController.get('model');
          if (model && model.hasLottery) {
            console.log("🎲 页面加载的抽奖主题:", {
              id: model.id,
              lottery_data: model.lottery_data,
              lottery_status: model.lottery_status
            });
          }
        }
      });

      // 全局调试方法
      window.debugLottery = function() {
        const composer = api.container.lookup('controller:composer');
        if (composer) {
          const model = composer.get('model');
          console.log("🎲 当前Composer状态:");
          console.log("  - lottery_data:", model.get('lottery_data'));
          console.log("  - lottery_status:", model.get('lottery_status'));
          console.log("  - custom_fields:", model.get('custom_fields'));
          console.log("  - 缓存数据:", window.lotteryFormDataCache);
        } else {
          console.log("🎲 未找到Composer");
        }
      };

      console.log("🎲 抽奖表单初始化器完成");
      console.log("🎲 可使用 window.debugLottery() 进行调试");
    });
  },
};
