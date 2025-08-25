// assets/javascripts/discourse/initializers/lottery-form-initializer.js
import { withPluginApi } from "discourse/lib/plugin-api";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖表单初始化器启动 - 最终修复版");

      // === 第一步：注册自定义字段序列化（官方推荐） ===
      api.serializeOnCreate('lottery_data');
      api.serializeOnCreate('lottery_status');
      api.serializeToDraft('lottery_data');
      api.serializeToDraft('lottery_status');
      api.serializeToTopic('lottery_data', 'topic.lottery_data');
      api.serializeToTopic('lottery_status', 'topic.lottery_status');

      console.log("🎲 已注册字段序列化");

      // === 第二步：扩展Topic模型（前端） ===
      api.modifyClass('model:topic', {
        pluginId: 'discourse-lottery-v3',

        hasLottery: computed('lottery_data', function() {
          return this.lottery_data && Object.keys(this.lottery_data).length > 0;
        }),

        lotteryStatus: computed('lottery_status', function() {
          return this.lottery_status || 'none';
        })
      });

      console.log("🎲 已扩展Topic模型");

      // === 第三步：扩展Composer控制器（修复custom_fields问题） ===
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        save(options) {
          console.log("🎲 Composer保存开始 - 修复版");
          
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
              
              // === 关键修复：确保custom_fields存在并正确设置 ===
              if (!model.get('custom_fields')) {
                model.set('custom_fields', {});
              }
              
              // 设置到custom_fields（确保后端能接收到）
              model.set('custom_fields.lottery_data', JSON.stringify(window.lotteryFormDataCache));
              model.set('custom_fields.lottery_status', 'running');
              
              // 标记属性变更（触发序列化）
              model.notifyPropertyChange('lottery_data');
              model.notifyPropertyChange('lottery_status');
              model.notifyPropertyChange('custom_fields');
              
              console.log("🎲 抽奖数据已设置到模型和custom_fields");
              console.log("🎲 模型lottery_data:", model.get('lottery_data'));
              console.log("🎲 模型lottery_status:", model.get('lottery_status'));
              console.log("🎲 模型custom_fields:", model.get('custom_fields'));
              
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
              
              // 确保custom_fields设置
              if (!model.get('custom_fields')) {
                model.set('custom_fields', {});
              }
              model.set('custom_fields.lottery_data', JSON.stringify(componentData));
              model.set('custom_fields.lottery_status', 'running');
              
              model.notifyPropertyChange('lottery_data');
              model.notifyPropertyChange('lottery_status');
              model.notifyPropertyChange('custom_fields');
            }
          }

          // 输出最终模型状态用于调试
          console.log("🎲 保存前最终模型状态:");
          console.log("  - lottery_data:", model.get('lottery_data'));
          console.log("  - lottery_status:", model.get('lottery_status'));
          console.log("  - custom_fields:", model.get('custom_fields'));
          
          return this._super(options);
        }
      });

      console.log("🎲 已扩展Composer控制器");

      // === 第四步：扩展Composer模型确保数据传递 ===
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",

        // 安全的serialize方法
        serialize() {
          let result;
          
          // 安全调用父类方法
          try {
            result = this._super() || {};
          } catch (error) {
            console.warn("🎲 父类serialize出错，使用空对象:", error);
            result = {};
          }
          
          // 确保结果是对象
          if (!result || typeof result !== 'object') {
            result = {};
          }
          
          // 确保抽奖数据包含在序列化结果中
          if (this.lottery_data) {
            result.lottery_data = this.lottery_data;
            result.lottery_status = this.lottery_status || 'running';
            
            // 确保custom_fields也包含
            if (!result.custom_fields) {
              result.custom_fields = {};
            }
            result.custom_fields.lottery_data = JSON.stringify(this.lottery_data);
            result.custom_fields.lottery_status = this.lottery_status || 'running';
            
            console.log("🎲 模型序列化包含抽奖数据:", {
              lottery_data: result.lottery_data,
              lottery_status: result.lottery_status,
              custom_fields: result.custom_fields
            });
          }
          
          return result;
        },

        // 重写createPost确保传递
        createPost(options = {}) {
          console.log("🎲 createPost调用，传递抽奖数据");
          
          if (this.lottery_data) {
            // 直接设置到options
            options.lottery_data = this.lottery_data;
            options.lottery_status = this.lottery_status || 'running';
            
            // 确保custom_fields传递
            if (!options.custom_fields) {
              options.custom_fields = {};
            }
            options.custom_fields.lottery_data = JSON.stringify(this.lottery_data);
            options.custom_fields.lottery_status = this.lottery_status || 'running';
            
            console.log("🎲 createPost传递的选项:", {
              lottery_data: options.lottery_data,
              lottery_status: options.lottery_status,
              custom_fields: options.custom_fields
            });
          }
          
          return this._super(options);
        }
      });

      console.log("🎲 已扩展Composer模型");

      // === 第五步：监听保存事件进行最后检查 ===
      api.onAppEvent('topic:created', (data) => {
        console.log("🎲 主题创建事件触发:", data);
        if (data.lottery_data) {
          console.log("🎲 主题创建成功，包含抽奖数据");
        }
      });

      // === 第六步：调试和验证工具 ===
      
      // 全局调试方法（增强版）
      window.debugLottery = function() {
        const composer = api.container.lookup('controller:composer');
        if (composer) {
          const model = composer.get('model');
          console.log("🎲 当前Composer详细状态:");
          console.log("  - lottery_data:", model.get('lottery_data'));
          console.log("  - lottery_status:", model.get('lottery_status'));
          console.log("  - custom_fields:", model.get('custom_fields'));
          console.log("  - 缓存数据:", window.lotteryFormDataCache);
          
          // 安全的序列化测试
          try {
            const serialized = model.serialize();
            console.log("  - 模型序列化结果:", serialized);
          } catch (error) {
            console.error("  - 序列化错误:", error);
          }
          
          // 测试设置custom_fields
          if (!model.get('custom_fields')) {
            console.log("🎲 custom_fields为空，尝试初始化");
            model.set('custom_fields', {});
            console.log("🎲 初始化后custom_fields:", model.get('custom_fields'));
          }
        } else {
          console.log("🎲 未找到Composer");
        }
      };

      // 简化的测试保存方法
      window.testLotterySave = function() {
        const composer = api.container.lookup('controller:composer');
        if (composer && composer.get('model.lottery_data')) {
          console.log("🎲 手动触发保存测试");
          const model = composer.get('model');
          
          // 确保数据设置正确
          if (!model.get('custom_fields')) {
            model.set('custom_fields', {});
          }
          model.set('custom_fields.lottery_data', JSON.stringify(model.get('lottery_data')));
          model.set('custom_fields.lottery_status', model.get('lottery_status'));
          model.notifyPropertyChange('custom_fields');
          
          console.log("🎲 测试前模型状态:", {
            lottery_data: model.get('lottery_data'),
            custom_fields: model.get('custom_fields')
          });
          
          // 不调用序列化，避免错误
          alert("测试数据已设置，请查看控制台输出后点击发布");
        } else {
          alert("请先创建抽奖数据");
        }
      };

      console.log("🎲 抽奖表单初始化器完成");
      console.log("🎲 可使用 window.debugLottery() 和 window.testLotterySave() 进行调试");
    });
  },
};
