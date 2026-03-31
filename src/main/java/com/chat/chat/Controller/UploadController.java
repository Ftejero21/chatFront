package com.chat.chat.Controller;

import com.chat.chat.DTO.AudioUploadResponseDTO;
import com.chat.chat.DTO.FileUploadResponseDTO;
import com.chat.chat.Exceptions.ApiError;
import com.chat.chat.Security.HttpRateLimitService;
import com.chat.chat.Service.UploadService.UploadService;
import com.chat.chat.Utils.Constantes;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping(Constantes.API_UPLOADS_ALL)
@Tag(name = "Uploads", description = "Carga de archivos multimedia para mensajeria.")
public class UploadController {

    @Autowired
    private UploadService uploadService;

    @Autowired
    private HttpRateLimitService httpRateLimitService;

    @PostMapping(value = Constantes.UPLOAD_AUDIO, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir audio", description = "Guarda un archivo de audio y devuelve su URL publica y metadatos.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Audio subido", content = @Content(schema = @Schema(implementation = AudioUploadResponseDTO.class))),
            @ApiResponse(responseCode = "400", description = "Archivo invalido", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public AudioUploadResponseDTO uploadAudio(
            @Parameter(description = "Archivo de audio (multipart/form-data)") @RequestParam(Constantes.KEY_FILE) MultipartFile file,
            @Parameter(description = "Duracion aproximada en milisegundos") @RequestParam(value = Constantes.KEY_DUR_MS, required = false) Integer durMs,
            @RequestParam(value = "chatId") Long chatId,
            @RequestParam(value = "messageId", required = false) Long messageId,
            HttpServletRequest request) {
        httpRateLimitService.checkUpload(request, "audio");
        return uploadService.uploadAudio(file, durMs, chatId, messageId);
    }

    @PostMapping(value = {Constantes.UPLOAD_FILE, Constantes.UPLOAD_MEDIA, Constantes.UPLOAD_IMAGE}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir binario cifrado", description = "Guarda bytes cifrados tal cual para mensajes E2E de imagen/medio y devuelve URL, MIME, nombre y tamano.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Archivo subido", content = @Content(schema = @Schema(implementation = FileUploadResponseDTO.class))),
            @ApiResponse(responseCode = "400", description = "Archivo invalido", content = @Content(schema = @Schema(implementation = ApiError.class)))
    })
    public FileUploadResponseDTO uploadEncryptedFile(
            @Parameter(description = "Archivo cifrado (multipart/form-data)") @RequestParam(Constantes.KEY_FILE) MultipartFile file,
            @RequestParam(value = "chatId") Long chatId,
            @RequestParam(value = "messageId", required = false) Long messageId,
            HttpServletRequest request) {
        httpRateLimitService.checkUpload(request, "file");
        return uploadService.uploadEncryptedFile(file, chatId, messageId);
    }

    @GetMapping(value = "/file/download")
    @Operation(summary = "Descargar binario cifrado", description = "Descarga segura con Content-Disposition attachment y auditoria.")
    public ResponseEntity<Resource> downloadEncryptedFile(
            @RequestParam("url") String url,
            @RequestParam(value = "chatId") Long chatId,
            @RequestParam(value = "messageId") Long messageId,
            HttpServletRequest request) {
        httpRateLimitService.checkUpload(request, "file-download");
        return uploadService.downloadEncryptedFile(url, chatId, messageId);
    }
}
