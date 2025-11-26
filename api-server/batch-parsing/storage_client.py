"""
Storage Client Module
Handles file download from SeaweedFS (S3-compatible) or local filesystem
"""

import os
import tempfile
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

class StorageClient:
    """
    Storage client for downloading batch files from SeaweedFS or local filesystem
    Supports both S3-compatible (SeaweedFS) and local file paths
    """

    def __init__(self, storage_mode: str = 'seaweedfs'):
        """
        Initialize storage client

        Args:
            storage_mode: 'seaweedfs' or 'local'
        """
        self.storage_mode = storage_mode
        self.temp_files = []  # Track temp files for cleanup

        if storage_mode == 'seaweedfs':
            # Initialize S3-compatible client for SeaweedFS
            self.s3_client = boto3.client(
                's3',
                endpoint_url=os.getenv('SEAWEEDFS_ENDPOINT', 'http://seaweedfs:8333'),
                aws_access_key_id=os.getenv('SEAWEEDFS_ACCESS_KEY', 'admin'),
                aws_secret_access_key=os.getenv('SEAWEEDFS_SECRET_KEY', 'admin'),
                config=Config(signature_version='s3v4'),
                region_name='us-east-1'  # SeaweedFS doesn't care about region
            )
            self.bucket_name = os.getenv('SEAWEEDFS_BUCKET', 'repositories')
            logger.info(f"Initialized SeaweedFS client: endpoint={os.getenv('SEAWEEDFS_ENDPOINT')}, bucket={self.bucket_name}")
        else:
            self.s3_client = None
            self.local_storage_path = os.getenv('LOCAL_STORAGE_PATH', '/app/uploads')
            logger.info(f"Initialized local storage client: path={self.local_storage_path}")

    def download(self, file_path: str) -> str:
        """
        Download file from storage to local temp directory

        Args:
            file_path: Storage path (e.g., 'batches/user@email.com/project-id/file.csv')

        Returns:
            Local file path
        """
        if self.storage_mode == 'seaweedfs':
            return self._download_from_seaweedfs(file_path)
        else:
            return self._get_local_path(file_path)

    def _download_from_seaweedfs(self, file_path: str) -> str:
        """
        Download file from SeaweedFS to temp directory

        Args:
            file_path: S3 key (e.g., 'batches/user@email.com/project-id/file.csv')

        Returns:
            Local temp file path
        """
        try:
            # Create temp file with same extension
            file_ext = Path(file_path).suffix
            temp_fd, temp_path = tempfile.mkstemp(suffix=file_ext, prefix='batch_')
            os.close(temp_fd)  # Close fd, we'll use the path

            # Track for cleanup
            self.temp_files.append(temp_path)

            # Download from SeaweedFS
            logger.info(f"Downloading from SeaweedFS: bucket={self.bucket_name}, key={file_path}")
            self.s3_client.download_file(
                Bucket=self.bucket_name,
                Key=file_path,
                Filename=temp_path
            )

            logger.info(f"Downloaded to temp file: {temp_path}")
            return temp_path

        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code', 'Unknown')
            logger.error(f"Failed to download from SeaweedFS: {error_code} - {str(e)}")
            raise RuntimeError(f"SeaweedFS download failed: {error_code}") from e
        except Exception as e:
            logger.error(f"Unexpected error downloading file: {str(e)}")
            raise

    def _get_local_path(self, file_path: str) -> str:
        """
        Get local file path (for local storage mode)

        Args:
            file_path: Relative path (e.g., 'batches/user@email.com/project-id/file.csv')

        Returns:
            Absolute local file path
        """
        # Construct absolute path
        abs_path = os.path.join(self.local_storage_path, file_path)

        # Verify file exists
        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"Local file not found: {abs_path}")

        logger.info(f"Using local file: {abs_path}")
        return abs_path

    def cleanup(self, file_path: Optional[str] = None):
        """
        Cleanup temp files

        Args:
            file_path: Specific file to cleanup, or None to cleanup all tracked files
        """
        if file_path:
            # Cleanup specific file
            if file_path in self.temp_files:
                try:
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logger.debug(f"Cleaned up temp file: {file_path}")
                    self.temp_files.remove(file_path)
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {file_path}: {e}")
        else:
            # Cleanup all tracked temp files
            for temp_file in self.temp_files[:]:  # Copy list to avoid modification during iteration
                try:
                    if os.path.exists(temp_file):
                        os.remove(temp_file)
                        logger.debug(f"Cleaned up temp file: {temp_file}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup temp file {temp_file}: {e}")
            self.temp_files.clear()

    def get_file_size(self, file_path: str) -> int:
        """
        Get file size from storage

        Args:
            file_path: Storage path

        Returns:
            File size in bytes
        """
        if self.storage_mode == 'seaweedfs':
            try:
                response = self.s3_client.head_object(
                    Bucket=self.bucket_name,
                    Key=file_path
                )
                return response['ContentLength']
            except ClientError as e:
                logger.error(f"Failed to get file size from SeaweedFS: {e}")
                return 0
        else:
            abs_path = os.path.join(self.local_storage_path, file_path)
            if os.path.exists(abs_path):
                return os.path.getsize(abs_path)
            return 0

    def __del__(self):
        """Cleanup on destruction"""
        self.cleanup()
