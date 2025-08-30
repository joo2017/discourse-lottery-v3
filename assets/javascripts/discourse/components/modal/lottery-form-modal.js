// assets/javascripts/discourse/components/modal/lottery-form-modal.js
import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { isBlank, isPresent } from "@ember/utils";
import { ajax } from "discourse/lib/ajax";

export default class LotteryFormModal extends Component {
  @service modal;
  @service site;
  @service appEvents;
  @service dialog;

  // 表单数据
  @tracked prizeName = "";
  @tracked prizeDetails = "";
  @tracked drawTime = "";
  @tracked winnersCount = 1;
  @tracked specifiedPosts = "";
  @tracked minParticipants = 5;
  @tracked backupStrategy = "continue";
  @tracked additionalNotes = "";
  @tracked prizeImage = "";
  @tracked prizeImagePreview = "";
  @tracked isImageUploading = false;

  // 状态管理
  @tracked isLoading = false;
  @tracked flash = "";
  @tracked flashType = "";
  @tracked validationErrors = {};

  constructor(owner, args) {
    super(owner, args);
    this.initializeDefaults();
  }

  initializeDefaults() {
    this.minParticipants = this.globalMinParticipants;

    // 设置默认开奖时间为1小时后
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1);
    this.drawTime = new Date(defaultTime.getTime() - (defaultTime.getTimezoneOffset() * 60000))
                    .toISOString().slice(0, 16);
  }

  get globalMinParticipants() {
    // 确保从 siteSettings 获取，如果失败则提供一个安全默认值
    return this.args.model?.siteSettings?.lottery_min_participants_global || 5;
  }
  
  // 实时前端校验逻辑
  get isValid() {
    this.validationErrors = {};
    let isValid = true;

    if (isBlank(this.prizeName)) {
      this.validationErrors.prizeName = "活动名称不能为空";
      isValid = false;
    } else if (this.prizeName.length > 100) {
      this.validationErrors.prizeName = "活动名称不能超过100个字符";
      isValid = false;
    }

    if (isBlank(this.prizeDetails)) {
      this.validationErrors.prizeDetails = "奖品说明不能为空";
      isValid = false;
    } else if (this.prizeDetails.length > 500) {
      this.validationErrors.prizeDetails = "奖品说明不能超过500个字符";
      isValid = false;
    }

    if (isBlank(this.drawTime)) {
      this.validationErrors.drawTime = "开奖时间不能为空";
      isValid = false;
    } else {
      const drawDate = new Date(this.drawTime);
      if (isNaN(drawDate.getTime())) {
        this.validationErrors.drawTime = "开奖时间格式无效";
        isValid = false;
      } else if (drawDate <= new Date()) {
        this.validationErrors.drawTime = "开奖时间必须是未来时间";
        isValid = false;
      }
    }

    if (this.minParticipants < this.globalMinParticipants) {
      this.validationErrors.minParticipants = `参与门槛不能低于全局设置的 ${this.globalMinParticipants} 人`;
      isValid = false;
    }

    if (this.winnersCount < 1 || this.winnersCount > 100) {
      this.validationErrors.winnersCount = "获奖人数必须在1-100之间";
      isValid = false;
    }

    if (isPresent(this.specifiedPosts)) {
      const posts = this.specifiedPosts.split(',').map(p => p.trim()).filter(p => p);
      const numbers = posts.map(p => parseInt(p)).filter(n => !isNaN(n) && n > 1);

      if (posts.length !== numbers.length || numbers.length === 0) {
        this.validationErrors.specifiedPosts = "指定楼层格式错误，且楼层号必须>1";
        isValid = false;
      } else if (numbers.length !== [...new Set(numbers)].length) {
        this.validationErrors.specifiedPosts = "指定楼层不能包含重复数字";
        isValid = false;
      }
    }

    if (isPresent(this.additionalNotes) && this.additionalNotes.length > 300) {
      this.validationErrors.additionalNotes = "补充说明不能超过300个字符";
      isValid = false;
    }

    return isValid;
  }

  @action showFlash(message, type = "error") { this.flash = message; this.flashType = type; }
  @action clearFlash() { this.flash = ""; this.flashType = ""; }

  @action updatePrizeName(event) { this.prizeName = event.target.value; }
  @action updatePrizeDetails(event) { this.prizeDetails = event.target.value; }
  @action updateDrawTime(event) { this.drawTime = event.target.value; }
  @action updateWinnersCount(event) { this.winnersCount = parseInt(event.target.value, 10) || 1; }
  @action updateSpecifiedPosts(event) { this.specifiedPosts = event.target.value; }
  @action updateMinParticipants(event) { this.minParticipants = parseInt(event.target.value, 10) || this.globalMinParticipants; }
  @action updateBackupStrategy(event) { this.backupStrategy = event.target.value; }
  @action updateAdditionalNotes(event) { this.additionalNotes = event.target.value; }

  @action
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return this.dialog.alert("请选择一个有效的图片文件。");
    }

    if (file.size > (3 * 1024 * 1024)) {
      return this.dialog.alert("图片文件大小不能超过 3MB。");
    }

    this.isImageUploading = true;
    this.clearFlash();

    try {
      const reader = new FileReader();
      reader.onload = (e) => { this.prizeImagePreview = e.target.result; };
      reader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_type', 'composer');

      const response = await ajax('/uploads.json', {
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false
      });

      if (response && response.url) {
        this.prizeImage = response.url;
        this.showFlash("图片上传成功！", "success");
      } else {
        throw new Error('服务器返回的上传数据格式不正确');
      }
    } catch (error) {
      console.error("Image upload failed", error);
      this.dialog.alert(`图片上传失败: ${error.message || '请检查网络或联系管理员'}`);
      this.prizeImagePreview = "";
    } finally {
      this.isImageUploading = false;
    }
  }

  @action
  removeImage() {
    this.prizeImage = "";
    this.prizeImagePreview = "";
    const fileInput = document.getElementById('lottery-image-upload');
    if (fileInput) { fileInput.value = ''; }
  }

  // 关键的提交方法
  @action
  async submit() {
    this.clearFlash();

    if (!this.isValid) {
      const firstErrorKey = Object.keys(this.validationErrors)[0];
      const firstError = this.validationErrors[firstErrorKey];
      this.showFlash(firstError, "error");
      return;
    }

    this.isLoading = true;

    try {
      // 1. 构建抽奖数据对象
      const lotteryData = {
        prize_name: this.prizeName.trim(),
        prize_details: this.prizeDetails.trim(),
        draw_time: this.drawTime.trim(),
        winners_count: this.winnersCount,
        specified_posts: this.specifiedPosts.trim(),
        min_participants: this.minParticipants,
        backup_strategy: this.backupStrategy,
        additional_notes: this.additionalNotes.trim(),
        prize_image: this.prizeImage.trim()
      };

      // 2. 获取 Composer 模型
      const composer = this.args.model.composer;
      const model = composer.get("model");
      
      const lotteryJSON = JSON.stringify(lotteryData);

      // 3. 关键步骤: 将数据设置到 composer model 的 'lottery' 属性上。
      //    `api.serializeOnCreate('lottery')` 会在后台自动寻找这个属性并发送它。
      model.set("lottery", lotteryJSON);

      // 4. (可选但推荐) 同时保存到 custom_fields，这对于草稿功能和数据一致性有好处
      if (!model.custom_fields) {
        model.set("custom_fields", {});
      }
      model.set("custom_fields.lottery", lotteryJSON);
      
      // 5. 在编辑器中插入占位符供用户查看
      const placeholder = this.buildLotteryPlaceholder(lotteryData);
      // 使用官方推荐的事件来插入文本，而不是直接修改 model.reply
      this.appEvents.trigger("composer:insert-text", placeholder);
      
      this.showFlash("抽奖信息已成功插入！", "success");

      setTimeout(() => {
        this.args.closeModal();
      }, 1000);

    } catch (error) {
      console.error("Lottery submission failed:", error);
      this.showFlash(`处理失败: ${error.message || '未知错误'}`, "error");
    } finally {
      this.isLoading = false;
    }
  }

  buildLotteryPlaceholder(lotteryData) {
    let placeholder = `\n[lottery]\n`;
    placeholder += `活动名称：${lotteryData.prize_name}\n`;
    placeholder += `奖品说明：${lotteryData.prize_details}\n`;
    placeholder += `开奖时间：${lotteryData.draw_time}\n`;
    
    if (lotteryData.specified_posts) {
      placeholder += `抽奖方式：指定楼层\n`;
      placeholder += `指定楼层：${lotteryData.specified_posts}\n`;
    } else {
      placeholder += `抽奖方式：随机抽取\n`;
      placeholder += `获奖人数：${lotteryData.winners_count}\n`;
    }
    
    placeholder += `参与门槛：${lotteryData.min_participants} 人\n`;
    
    if (lotteryData.additional_notes) {
      placeholder += `补充说明：${lotteryData.additional_notes}\n`;
    }
    
    if (lotteryData.prize_image) {
      placeholder += `奖品图片：${lotteryData.prize_image}\n`;
    }
    
    placeholder += `[/lottery]\n\n`;
    return placeholder;
  }

  @action
  cancel() {
    this.args.closeModal();
  }
}
