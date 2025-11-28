import { Module } from "@nestjs/common"
import { HttpModule } from "@nestjs/axios"
import { WhatsappService } from "./whatsapp.service"
import { WhatsappController } from "./whatsapp.controller"
import { MulterModule } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { extname } from "path"


@Module({
  imports: [
    HttpModule,
    MulterModule.register({
      storage: diskStorage({
        destination: "./uploads",
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
          const ext = extname(file.originalname)
          const filename = `${uniqueSuffix}${ext}`
          callback(null, filename)
        },
      }),
    }),
  ],
  controllers: [WhatsappController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule { }
