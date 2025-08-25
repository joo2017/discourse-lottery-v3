import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { inject as service } from "@ember/service";

export default class LotteryFormModal extends Component {
  @service modal;
  @service site;

  // 表单数据（使用 @tracked 进行响应式更新）
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked prizeImage = "";  // 图片URL
  @tracked prizeImagePreview = "";  // 图片预览URL
  @tracked isImageUploading = false;  // 图片上传状态
  
  // 状态管理
  @tracked isLoading = false;
  @tracked flash = "";
  @tracked flashType = "";

  constructor(owner, args) {
    super(owner, args);
    console.log("🎲 抽奖表单模态框组件初始化");
    console.log("🎲 传入的模型数据:", this.args.model);
    
    // 初始化最小参与人数
    this.minParticipants = this.args.model?.siteSettings?.lottery_min_participants_global || 5;
    
    // 设置默认开奖时间（1小时后）
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = defaultTime.toISOString().slice(0, 16);

    console.log("🎲 初始化完成，默认开奖时间:", this.drawTime);
    console.log("🎲 最小参与人数:", this.minParticipants);
  }

  // 表单验证
  get isValid() {
    const hasRequiredFields = this.prizeName.trim() && 
                             this.prizeDetails.trim() && 
                             this.drawTime.trim();
    const hasValidMinParticipants = this.minParticipants >= this.globalMinParticipants;
    
    const valid = hasRequiredFields && hasValidMinParticipants;
    console.log("🎲 表单验证结果:", {
      hasRequiredFields,
      hasValidMinParticipants,
      valid
    });
    
    return valid;
  }

  // 获取全局最小参与人数
  get globalMinParticipants() {
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }

  // 显示 flash 消息
  @action
  showFlash(message, type = "error") {
    console.log("🎲 显示 flash 消息:", message, type);
    this.flash = message;
    this.flashType = type;
  }

  // 清除 flash 消息
  @action
  clearFlash() {
    console.log("🎲 清除 flash 消息");
    this.flash = "";
    this.flashType = "";
  }

  // 更新表单字段的方法
  @action
  updatePrizeName(event) {
    this.prizeName = event.target.value;
    this.clearFlash();
    console.log("🎲 更新活动名称:", this.prizeName);
  }

  @action
  updatePrizeDetails(event) {
    this.prizeDetails = event.target.value;
    this.clearFlash();
    console.log("🎲 更新奖品说明:", this.prizeDetails);
  }

  @action
  updateDrawTime(event) {
    this.drawTime = event.target.value;
    this.clearFlash();
    console.log("🎲 更新开奖时间:", this.drawTime);
  }

  @action
  updateWinnersCount(event) {
    this.winnersCount = parseInt(event.target.value) || 1;
    console.log("🎲 更新获奖人数:", this.winnersCount);
  }

  @action
  updateSpecifiedPosts(event) {
    this.specifiedPosts = event.target.value;
    console.log("🎲 更新指定楼层:", this.specifiedPosts);
  }

  @action
  updateMinParticipants(event) {
    const num = parseInt(event.target.value) || 0;
    this.minParticipants = Math.max(num, this.globalMinParticipants);
    this.clearFlash();
    console.log("🎲 更新参与门槛:", this.minParticipants);
  }

  @action
  updateBackupStrategy(event) {
    this.backupStrategy = event.target.value;
    console.log("🎲 更新后备策略:", this.backupStrategy);
  }

  @action
  updateAdditionalNotes(event) {
    this.additionalNotes = event.target.value;
    console.log("🎲 更新补充说明:", this.additionalNotes);
  }

  @action
  updatePrizeImage(event) {
    this.prizeImage = event.target.value;
    console.log("🎲 更新奖品图片:", this.prizeImage);
  }

  // 处理图片上传
  @action
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      this.showFlash("请选择图片文件", "error");
      return;
    }

    // 验证文件大小 (3MB)
    if (file.size > 3 * 1024 * 1024) {
      this.showFlash("图片文件大小不能超过 3MB", "error");
      return;
    }

    this.isImageUploading = true;
    console.log("🎲 开始上传图片:", file.name);

    try {
      // 创建预览
      const reader = new FileReader();
      reader.onload = (e) => {
        this.prizeImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);

      // 使用 Discourse 的上传 API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'composer');

      const response = await fetch('/uploads.json', {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        this.prizeImage = data.url;
        console.log("🎲 图片上传成功:", this.prizeImage);
        this.showFlash("图片上传成功", "success");
      } else {
        throw new Error('上传失败');
      }
    } catch (error) {
      console.error("🎲 图片上传失败:", error);
      this.showFlash("图片上传失败，请重试", "error");
      this.prizeImagePreview = "";
    } finally {
      this.isImageUploading = false;
    }
  }

  // 移除图片
  @action
  removeImage() {
    this.prizeImage = "";
    this.prizeImagePreview = "";
    console.log("🎲 移除图片");
  }

  // 提交表单
  @action
  async submit() {
    console.log("🎲 开始提交抽奖表单");
    this.clearFlash();

    if (!this.isValid) {
      this.showFlash("请填写所有必填字段");
      return;
    }

    // 验证时间格式和有效性
    try {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime())) {
        this.showFlash("开奖时间格式无效");
        return;
      }
      if (drawDate <= new Date()) {
        this.showFlash("开奖时间必须是未来时间");
        return;
      }
    } catch (e) {
      this.showFlash("开奖时间格式无效");
      return;
    }

    // 验证参与门槛
    if (this.minParticipants < this.globalMinParticipants) {
      this.showFlash(`参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`);
      return;
    }

    this.isLoading = true;
    console.log("🎲 开始处理表单提交，设置加载状态");

    try {
      // 构建抽奖数据
      const lotteryData = {
        prize_name: this.prizeName.trim(),
        prize_details: this.prizeDetails.trim(),
        draw_time: this.drawTime.trim(),
        winners_count: this.winnersCount,
        specified_posts: this.specifiedPosts.trim(),
        min_participants: this.minParticipants,
        backup_strategy: this.backupStrategy,
        additional_notes: this.additionalNotes.trim(),
        prize_image: this.prizeImage.trim()  // 新增：图片字段
      };

      console.log("🎲 构建的抽奖数据对象:", lotteryData);

      // 缓存数据供后续使用
      window.lotteryFormDataCache = lotteryData;
      console.log("🎲 数据已缓存到 window.lotteryFormDataCache");

      // 构建完整的占位符内容（修复后的版本）
      let placeholder = `\n[lottery]\n`;
      placeholder += `活动名称：${lotteryData.prize_name}\n`;
      placeholder += `奖品说明：${lotteryData.prize_details}\n`;
      placeholder += `开奖时间：${lotteryData.draw_time}\n`;
      
      // 智能判断抽奖方式
      if (lotteryData.specified_posts && lotteryData.specified_posts.trim()) {
        placeholder += `抽奖方式：指定楼层\n`;
        placeholder += `指定楼层：${lotteryData.specified_posts}\n`;
      } else {
        placeholder += `抽奖方式：随机抽取\n`;
        placeholder += `获奖人数：${lotteryData.winners_count}\n`;
      }
      
      placeholder += `参与门槛：${lotteryData.min_participants}人\n`;
      
      // 补充说明（如果有）
      if (lotteryData.additional_notes && lotteryData.additional_notes.trim()) {
        placeholder += `补充说明：${lotteryData.additional_notes}\n`;
      }
      
      // 奖品图片（如果有）
      if (lotteryData.prize_image && lotteryData.prize_image.trim()) {
        placeholder += `奖品图片：${lotteryData.prize_image}\n`;
      }
      
      placeholder += `[/lottery]\n\n`;
      
      // 获取编辑器并插入内容
      const composer = this.args.model?.composer;
      console.log("🎲 获取编辑器实例:", composer);
      
      if (composer) {
        const currentText = composer.get("model.reply") || "";
        composer.set("model.reply", currentText + placeholder);

        console.log("🎲 抽奖内容成功插入到编辑器");
        console.log("🎲 插入的完整占位符:", placeholder);
        
        // 显示成功消息
        this.showFlash("抽奖信息已插入编辑器", "success");
        
        // 延迟关闭模态框，让用户看到成功提示
        setTimeout(() => {
          console.log("🎲 关闭模态框");
          this.args.closeModal();
        }, 1500);
      } else {
        console.error("🎲 无法获取编辑器实例");
        this.showFlash("无法获取编辑器，请刷新页面重试");
      }
    } catch (error) {
      console.error("🎲 提交表单时发生错误:", error);
      this.showFlash("提交失败：" + error.message);
    } finally {
      this.isLoading = false;
      console.log("🎲 清除加载状态");
    }
  }

  // 取消操作
  @action
  cancel() {
    console.log("🎲 用户取消抽奖表单");
    this.args.closeModal();
  }
}
