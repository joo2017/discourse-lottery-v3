// assets/javascripts/discourse/initializers/lottery-form-initializer.js
import { withPluginApi } from "discourse/lib/plugin-api";
import { computed } from "@ember/object";

export default {
  name: "lottery-form-initializer",
  initialize() {
    withPluginApi("1.0.0", (api) => {
      console.log("🎲 抽奖表单初始化器启动 - 生产环境版本");

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
        }),

        // 添加便捷方法用于获取格式化的抽奖信息
        formattedLotteryInfo: computed('lottery_data', function() {
          const data = this.lottery_data;
          if (!data) return null;
          
          return {
            prizeName: data.prize_name,
            drawTime: data.draw_time,
            status: this.lottery_status,
            isActive: this.lottery_status === 'running',
            participantCount: data.current_participants || 0,
            minParticipants: data.min_participants
          };
        })
      });

      console.log("🎲 已扩展Topic模型");

      // === 第三步：扩展Composer控制器（生产环境完整版） ===
      api.modifyClass("controller:composer", {
        pluginId: "discourse-lottery-v3",

        save(options) {
          console.log("🎲 Composer保存开始 - 生产环境版");
          
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
              console.warn("🎲 缓存数据验证失败:", requiredFields.filter(field => 
                !window.lotteryFormDataCache[field] || !String(window.lotteryFormDataCache[field]).trim()
              ));
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
            console.log("🎲 设置抽奖数据到模型");
            
            // 设置到模型的直接属性（用于前端显示和API序列化）
            model.set('lottery_data', lotteryDataToSave);
            model.set('lottery_status', 'running');
            
            // 设置到custom_fields（用于数据库存储）
            if (!model.get('custom_fields')) {
              model.set('custom_fields', {});
            }
            model.set('custom_fields.lottery_data', JSON.stringify(lotteryDataToSave));
            model.set('custom_fields.lottery_status', 'running');
            
            // 通知属性变更以触发序列化
            model.notifyPropertyChange('lottery_data');
            model.notifyPropertyChange('lottery_status');
            model.notifyPropertyChange('custom_fields');
            
            console.log("🎲 抽奖数据设置完成:", {
              hasLotteryData: !!model.get('lottery_data'),
              hasCustomFields: !!model.get('custom_fields'),
              customFieldsKeys: Object.keys(model.get('custom_fields') || {})
            });
            
            // 清理缓存
            if (window.lotteryFormDataCache) {
              window.lotteryFormDataCache = null;
              console.log("🎲 已清理缓存数据");
            }
          }

          // 调用父类保存方法
          return this._super(options).then((result) => {
            console.log("🎲 保存完成，结果:", result);
            return result;
          }).catch((error) => {
            console.error("🎲 保存时发生错误:", error);
            throw error;
          });
        },

        // 扩展序列化方法确保数据包含在请求中
        serialize(options) {
          let data;
          
          // 安全调用父类序列化
          try {
            data = this._super(options) || {};
          } catch (error) {
            console.warn("🎲 父类序列化出错，使用基本数据:", error);
            data = {
              title: this.get('model.title'),
              raw: this.get('model.reply'),
              category: this.get('model.categoryId'),
              tags: this.get('model.tags'),
              custom_fields: this.get('model.custom_fields') || {}
            };
          }
          
          const model = this.get('model');
          
          // 确保抽奖数据包含在序列化结果中
          if (model.get('lottery_data')) {
            data.lottery_data = model.get('lottery_data');
            data.lottery_status = model.get('lottery_status') || 'running';
            
            // 确保custom_fields存在并包含抽奖数据
            if (!data.custom_fields) {
              data.custom_fields = {};
            }
            data.custom_fields.lottery_data = JSON.stringify(model.get('lottery_data'));
            data.custom_fields.lottery_status = model.get('lottery_status') || 'running';
            
            console.log("🎲 序列化时包含抽奖数据");
          }
          
          return data;
        }
      });

      console.log("🎲 已扩展Composer控制器");

      // === 第四步：扩展Composer模型确保数据传递到后端 ===
      api.modifyClass("model:composer", {
        pluginId: "discourse-lottery-v3",

        // 重写createPost方法确保抽奖数据传递到后端
        createPost(options = {}) {
          console.log("🎲 createPost调用 - 生产环境版");
          
          if (this.lottery_data) {
            console.log("🎲 包含抽奖数据到createPost选项");
            
            // 直接传递抽奖数据
            options.lottery_data = this.lottery_data;
            options.lottery_status = this.lottery_status || 'running';
            
            // 确保custom_fields传递（这是关键）
            if (!options.custom_fields) {
              options.custom_fields = {};
            }
            options.custom_fields.lottery_data = JSON.stringify(this.lottery_data);
            options.custom_fields.lottery_status = this.lottery_status || 'running';
            
            console.log("🎲 createPost最终选项:", {
              hasLotteryData: !!options.lottery_data,
              hasCustomFields: !!options.custom_fields,
              customFieldsLottery: !!options.custom_fields.lottery_data
            });
          }
          
          return this._super(options).then((result) => {
            console.log("🎲 createPost成功:", result);
            
            // 如果创建成功且包含抽奖数据，触发自定义事件
            if (this.lottery_data && result) {
              api.appEvents.trigger('lottery:topic-created', {
                topicId: result.topic_id,
                lotteryData: this.lottery_data
              });
            }
            
            return result;
          }).catch((error) => {
            console.error("🎲 createPost失败:", error);
            throw error;
          });
        },

        // 安全的序列化方法
        serialize() {
          let result;
          
          try {
            result = this._super() || {};
          } catch (error) {
            console.warn("🎲 模型序列化出错，构建基本结构:", error);
            result = {
              title: this.title,
              raw: this.reply,
              category: this.categoryId,
              tags: this.tags,
              custom_fields: this.custom_fields || {}
            };
          }
          
          // 确保结果是对象
          if (!result || typeof result !== 'object') {
            result = {};
          }
          
          // 包含抽奖数据
          if (this.lottery_data) {
            result.lottery_data = this.lottery_data;
            result.lottery_status = this.lottery_status || 'running';
            
            if (!result.custom_fields) {
              result.custom_fields = {};
            }
            result.custom_fields.lottery_data = JSON.stringify(this.lottery_data);
            result.custom_fields.lottery_status = this.lottery_status || 'running';
            
            console.log("🎲 模型序列化包含抽奖数据");
          }
          
          return result;
        }
      });

      console.log("🎲 已扩展Composer模型");

      // === 第五步：监听应用事件进行完整性检查 ===
      api.onAppEvent('topic:created', (data) => {
        console.log("🎲 主题创建事件:", data);
        if (data.lottery_data || data.hasLottery) {
          console.log("🎲 抽奖主题创建成功");
          
          // 可以在这里添加额外的处理逻辑
          // 比如显示成功通知、跳转等
        }
      });

      // 监听自定义抽奖事件
      api.onAppEvent('lottery:topic-created', (data) => {
        console.log("🎲 抽奖主题创建完成:", data);
        
        // 可以添加成功后的处理逻辑
        // 比如显示特殊提示、统计等
      });

      // === 第六步：错误处理和恢复机制 ===
      
      // 监听保存错误
      api.onAppEvent('composer:save-error', (error) => {
        if (window.lotteryFormDataCache || window.currentLotteryForm) {
          console.warn("🎲 保存出错但有抽奖数据，尝试恢复:", error);
          
          // 保留抽奖数据，不清理缓存
          // 用户可以再次尝试保存
        }
      });

      // === 第七步：生产环境调试工具 ===
      
      // 完整的调试方法（生产环境保留）
      window.debugLottery = function() {
        const composer = api.container.lookup('controller:composer');
        if (!composer) {
          console.log("🎲 未找到Composer实例");
          return;
        }
        
        const model = composer.get('model');
        console.log("🎲 当前Composer完整状态:");
        console.log("  📋 基本信息:");
        console.log("    - Title:", model.get('title'));
        console.log("    - Category:", model.get('categoryId'));
        console.log("    - Action:", model.get('action'));
        
        console.log("  🎲 抽奖相关:");
        console.log("    - lottery_data:", model.get('lottery_data'));
        console.log("    - lottery_status:", model.get('lottery_status'));
        console.log("    - custom_fields:", model.get('custom_fields'));
        console.log("    - 缓存数据:", window.lotteryFormDataCache);
        
        console.log("  🔧 状态检查:");
        console.log("    - hasLottery:", !!model.get('lottery_data'));
        console.log("    - hasCustomFields:", !!model.get('custom_fields'));
        
        // 安全的序列化测试
        try {
          const serialized = model.serialize();
          console.log("    - 序列化成功:", !!serialized);
          console.log("    - 序列化包含lottery_data:", !!serialized.lottery_data);
          console.log("    - 序列化包含custom_fields:", !!serialized.custom_fields);
        } catch (error) {
          console.warn("    - 序列化失败:", error.message);
        }
      };

      // 数据验证工具
      window.validateLotteryData = function() {
        const composer = api.container.lookup('controller:composer');
        if (!composer) return false;
        
        const model = composer.get('model');
        const lotteryData = model.get('lottery_data');
        
        if (!lotteryData) {
          console.log("🎲 没有抽奖数据");
          return false;
        }
        
        const requiredFields = ['prize_name', 'prize_details', 'draw_time', 'min_participants'];
        const missingFields = requiredFields.filter(field => !lotteryData[field]);
        
        if (missingFields.length > 0) {
          console.warn("🎲 缺少必填字段:", missingFields);
          return false;
        }
        
        console.log("🎲 抽奖数据验证通过");
        return true;
      };

      // 手动修复工具（生产环境可用）
      window.fixLotteryData = function() {
        const composer = api.container.lookup('controller:composer');
        if (!composer) {
          console.error("🎲 未找到Composer");
          return;
        }
        
        const model = composer.get('model');
        
        // 如果有缓存数据但模型中没有，尝试修复
        if (window.lotteryFormDataCache && !model.get('lottery_data')) {
          console.log("🎲 尝试修复抽奖数据");
          
          model.set('lottery_data', window.lotteryFormDataCache);
          model.set('lottery_status', 'running');
          
          if (!model.get('custom_fields')) {
            model.set('custom_fields', {});
          }
          model.set('custom_fields.lottery_data', JSON.stringify(window.lotteryFormDataCache));
          model.set('custom_fields.lottery_status', 'running');
          
          model.notifyPropertyChange('lottery_data');
          model.notifyPropertyChange('lottery_status');
          model.notifyPropertyChange('custom_fields');
          
          console.log("🎲 抽奖数据修复完成");
          return true;
        }
        
        console.log("🎲 无需修复或无数据可修复");
        return false;
      };

      console.log("🎲 抽奖表单初始化器完成 - 生产环境版本");
      console.log("🎲 可用调试命令: window.debugLottery(), window.validateLotteryData(), window.fixLotteryData()");
    });
  },
};
