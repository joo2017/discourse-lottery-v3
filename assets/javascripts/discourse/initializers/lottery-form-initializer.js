// assets/javascripts/discourse/initializers/lottery-form-initializer.js
import { withPluginApi } from "discourse/lib/plugin-api";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖表单初始化器启动 - 安全版本（不破坏原有功能）");

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

      // === 第三步：扩展Composer控制器（安全版本 - 不重写serialize） ===
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        save(options) {
          console.log("🎲 Composer保存开始 - 安全版本");
          
          const model = this.get("model");
          let lotteryDataToSave = null;
          
          // 检查缓存数据（主要来源）
          if (window.lotteryFormDataCache) {
            console.log("🎲 发现缓存的抽奖数据");
            
            // 验证数据完整性
            const requiredFields = ['prize_name', 'prize_details', 'draw_time', 'min_participants'];
            const isValid = requiredFields.every(field => 
              window.lotteryFormDataCache[field] && 
              String(window.lotteryFormDataCache[field]).trim()
            );
            
            if (isValid) {
              lotteryDataToSave = window.lotteryFormDataCache;
              console.log("🎲 缓存数据验证通过");
            } else {
              console.warn("🎲 缓存数据验证失败");
            }
          }
          
          // 检查活动组件数据（备用来源）
          else if (window.currentLotteryForm) {
            console.log("🎲 检查活动组件数据");
            const componentData = window.currentLotteryForm.getLotteryData();
            
            if (componentData && componentData.prize_name) {
              lotteryDataToSave = componentData;
              console.log("🎲 组件数据验证通过");
            }
          }
          
          // 如果有有效的抽奖数据，进行设置
          if (lotteryDataToSave) {
            console.log("🎲 设置抽奖数据到模型 - 安全方式");
            
            // 仅设置到模型属性，不干扰原有的序列化过程
            model.set('lottery_data', lotteryDataToSave);
            model.set('lottery_status', 'running');
            
            // 通知属性变更以触发API序列化
            model.notifyPropertyChange('lottery_data');
            model.notifyPropertyChange('lottery_status');
            
            console.log("🎲 抽奖数据设置完成");
            
            // 清理缓存
            if (window.lotteryFormDataCache) {
              window.lotteryFormDataCache = null;
              console.log("🎲 已清理缓存数据");
            }
          }

          // 直接调用父类保存方法，不干扰原有逻辑
          return this._super(options).then((result) => {
            console.log("🎲 保存完成");
            return result;
          }).catch((error) => {
            console.error("🎲 保存失败:", error);
            throw error;
          });
        }

        // 注意：完全移除了serialize方法的重写，让Discourse使用原生逻辑
      });

      console.log("🎲 已扩展Composer控制器");

      // === 第四步：扩展Composer模型（安全版本） ===
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",

        // 不重写serialize方法，仅在init时确保字段存在
        init() {
          this._super(...arguments);
          
          // 初始化抽奖相关字段
          if (!this.lottery_data) {
            this.set('lottery_data', null);
          }
          if (!this.lottery_status) {
            this.set('lottery_status', 'none');
          }
        }

        // 注意：完全移除了serialize和createPost的重写
      });

      console.log("🎲 已扩展Composer模型");

      // === 第五步：使用before_create_topic事件（更安全的方式） ===
      
      // 监听topic创建前的事件，直接设置数据
      api.modifyClass('model:composer', {
        pluginId: 'discourse-lottery-v3-safe',
        
        // 在发送请求前的最后时刻添加抽奖数据
        createPost(options = {}) {
          console.log("🎲 createPost调用 - 最小干预模式");
          
          // 如果有抽奖数据，添加到选项中
          if (this.lottery_data) {
            console.log("🎲 在createPost选项中添加抽奖数据");
            options.lottery_data = this.lottery_data;
            options.lottery_status = this.lottery_status || 'running';
          }
          
          return this._super(options);
        }
      });

      // === 第六步：调试工具（简化版） ===
      
      window.debugLottery = function() {
        const composer = api.container.lookup('controller:composer');
        if (!composer) {
          console.log("🎲 未找到Composer实例");
          return;
        }
        
        const model = composer.get('model');
        console.log("🎲 Composer状态（简化版）:");
        console.log("  📋 基本字段:");
        console.log("    - Title:", model.get('title'));
        console.log("    - Content length:", model.get('reply')?.length || 0);
        console.log("    - Category:", model.get('categoryId'));
        
        console.log("  🎲 抽奖字段:");
        console.log("    - lottery_data:", !!model.get('lottery_data'));
        console.log("    - lottery_status:", model.get('lottery_status'));
        console.log("    - 缓存数据:", !!window.lotteryFormDataCache);
        
        console.log("  ✅ 准备状态:");
        console.log("    - 可以发布:", !!(model.get('title') && model.get('reply') && model.get('categoryId')));
      };

      window.testBasicSave = function() {
        const composer = api.container.lookup('controller:composer');
        if (!composer) {
          console.error("未找到Composer");
          return;
        }
        
        const model = composer.get('model');
        console.log("🎲 测试基本保存功能:");
        console.log("  Title:", model.get('title'));
        console.log("  Content:", model.get('reply') ? "有内容" : "无内容");
        console.log("  Category:", model.get('categoryId'));
        
        if (!model.get('title')) {
          console.error("❌ 缺少标题");
          return;
        }
        if (!model.get('reply')) {
          console.error("❌ 缺少内容");
          return;
        }
        if (!model.get('categoryId')) {
          console.error("❌ 缺少分类");
          return;
        }
        
        console.log("✅ 基本字段完整，可以尝试发布");
      };

      console.log("🎲 抽奖表单初始化器完成 - 安全版本");
      console.log("🎲 调试命令: window.debugLottery(), window.testBasicSave()");
    });
  },
};
