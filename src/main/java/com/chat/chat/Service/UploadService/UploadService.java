package com.chat.chat.Service.UploadService;

import com.chat.chat.DTO.AudioUploadResponseDTO;
import com.chat.chat.DTO.FileUploadResponseDTO;
import org.springframework.core.io.Resource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.multipart.MultipartFile;

public interface UploadService {

    AudioUploadResponseDTO uploadAudio(MultipartFile file, Integer durMs, Long chatId, Long messageId);

    FileUploadResponseDTO uploadEncryptedFile(MultipartFile file, Long chatId, Long messageId);

    ResponseEntity<Resource> downloadEncryptedFile(String url, Long chatId, Long messageId);
}
